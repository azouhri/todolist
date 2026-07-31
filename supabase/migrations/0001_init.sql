-- Follow-up & Execution Manager — initial schema
--
-- Run once against the Supabase project (SQL Editor, or `supabase db push`).
--
-- Conventions:
--   * snake_case columns, per Postgres/PostgREST convention. The app maps them
--     onto its camelCase domain types in lib/supabase/rows.ts, so the UI is
--     unaffected.
--   * Status/priority stay text rather than Postgres enums: lib/domain/enums.ts
--     is the single source of truth and validates every write with zod, so a new
--     status needs no migration.
--   * Nothing derived is stored. days_waiting, needs_reminder and the task
--     status roll-up are computed at read time. The one exception is
--     tasks.completed_at, which the spec asks for.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.contacts (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  email       text,
  team        text,
  notes       text,
  -- At most one contact is the local user; enforced in the app layer.
  is_self     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id            text primary key default gen_random_uuid()::text,
  title         text not null,
  description   text,
  label         text,
  priority      text not null default 'medium',
  -- Manual override ('lost' | 'cancelled'); null means derive from subtasks.
  manual_status text,
  due_date      timestamptz,
  completed_at  timestamptz,
  sort_order    double precision not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.subtasks (
  id               text primary key default gen_random_uuid()::text,
  task_id          text not null references public.tasks (id) on delete cascade,
  -- Contacts that own subtasks cannot be deleted.
  owner_id         text not null references public.contacts (id) on delete restrict,
  title            text not null,
  description      text,
  status           text not null default 'not_started',
  priority         text not null default 'medium',
  -- Starts the days_waiting clock while status is 'waiting'.
  requested_date   timestamptz,
  due_date         timestamptz,
  completed_at     timestamptz,
  -- Per-subtask reminder cooldown; null inherits app_settings.
  alert_after_days integer,
  sort_order       double precision not null default 0,
  board_order      double precision not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.history_events (
  id          text primary key default gen_random_uuid()::text,
  subtask_id  text not null references public.subtasks (id) on delete cascade,
  type        text not null,
  note        text,
  -- Drives the reminder cooldown: the newest event resets it.
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create table if not exists public.app_settings (
  id                       text primary key default 'singleton',
  default_alert_after_days integer not null default 3,
  -- Pre-selected owner for new subtasks.
  default_owner_id         text references public.contacts (id) on delete set null,
  updated_at               timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists contacts_name_idx           on public.contacts (name);
create index if not exists tasks_sort_order_idx        on public.tasks (sort_order);
create index if not exists subtasks_task_id_idx        on public.subtasks (task_id);
create index if not exists subtasks_status_idx         on public.subtasks (status);
create index if not exists subtasks_owner_id_idx       on public.subtasks (owner_id);
create index if not exists history_subtask_id_idx      on public.history_events (subtask_id);
create index if not exists history_occurred_at_idx     on public.history_events (occurred_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at maintenance
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

drop trigger if exists subtasks_touch on public.subtasks;
create trigger subtasks_touch before update on public.subtasks
  for each row execute function public.touch_updated_at();

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- This is a single-account tool: authentication is a lock on a public URL, not
-- multi-tenancy. Any signed-in user sees everything; anonymous requests see
-- nothing. If it ever becomes multi-user, these are the policies to replace.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.contacts       enable row level security;
alter table public.tasks          enable row level security;
alter table public.subtasks       enable row level security;
alter table public.history_events enable row level security;
alter table public.app_settings   enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['contacts', 'tasks', 'subtasks', 'history_events', 'app_settings']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Atomic operations
--
-- These exist because two writes must not be able to half-succeed: if a status
-- change lands without its history event, days_waiting and the reminder
-- cooldown silently disagree — the exact thing this app exists to get right.
-- The decision logic stays in TypeScript (lib/domain/transitions.ts); these
-- functions only apply the result in one transaction.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.apply_subtask_transition(
  p_subtask_id text,
  p_patch      jsonb,
  p_event_type text default null,
  p_event_note text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.subtasks s
  set
    status         = coalesce(p_patch ->> 'status', s.status),
    requested_date = case when p_patch ? 'requested_date'
                          then (p_patch ->> 'requested_date')::timestamptz
                          else s.requested_date end,
    completed_at   = case when p_patch ? 'completed_at'
                          then (p_patch ->> 'completed_at')::timestamptz
                          else s.completed_at end,
    board_order    = case when p_patch ? 'board_order'
                          then (p_patch ->> 'board_order')::double precision
                          else s.board_order end
  where s.id = p_subtask_id;

  if not found then
    raise exception 'subtask % not found', p_subtask_id;
  end if;

  if p_event_type is not null then
    insert into public.history_events (subtask_id, type, note)
    values (p_subtask_id, p_event_type, p_event_note);
  end if;
end;
$$;

-- Float midpoints eventually run out of room between two neighbours; these
-- rewrite a whole list's ordering in one transaction.
create or replace function public.reindex_orders(
  p_table  text,
  p_column text,
  p_orders jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
begin
  if p_table not in ('tasks', 'subtasks') then
    raise exception 'unsupported table %', p_table;
  end if;
  if p_column not in ('sort_order', 'board_order') then
    raise exception 'unsupported column %', p_column;
  end if;

  for item in select * from jsonb_array_elements(p_orders)
  loop
    execute format('update public.%I set %I = $1 where id = $2', p_table, p_column)
      using (item ->> 'order')::double precision, item ->> 'id';
  end loop;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Execute grants
--
-- RLS already stops an anonymous caller changing rows (both functions are
-- security invoker), but there is no reason for anon to invoke them at all.
-- Fail at the door instead of silently affecting zero rows.
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.apply_subtask_transition(text, jsonb, text, text) from public, anon;
revoke execute on function public.reindex_orders(text, text, jsonb) from public, anon;

grant execute on function public.apply_subtask_transition(text, jsonb, text, text) to authenticated, service_role;
grant execute on function public.reindex_orders(text, text, jsonb) to authenticated, service_role;
