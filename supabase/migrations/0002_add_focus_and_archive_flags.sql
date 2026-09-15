-- Follow-up & Execution Manager — focus and archive flags on subtasks
--
-- This shipped straight to the live project and was never written back to the
-- repository, so `supabase/migrations/` stopped describing the real schema.
-- Anyone building from migrations — a new machine, a fresh Supabase project,
-- CI — got a subtasks table without these two columns, and the board and task
-- detail pages fail on the first query that selects them.
--
-- The body below is the SQL that was actually applied to the database
-- (recorded there as 20260805130058_add_focus_and_archive_flags), so a fresh
-- project built from 0001 + 0002 now matches production exactly.
--
-- Every statement is idempotent, which is what lets the live project and a new
-- one converge: re-running this where the columns already exist is a no-op.

-- Two independent flags so a long-range plan does not compete with today's work.
--
--   is_focused  - opt IN future work to the current horizon. Lets the full
--                 lifecycle of every offer be captured without all of it
--                 shouting for attention.
--   is_archived - opt OUT finished work from the default views, without
--                 deleting it or disturbing the roll-up (an archived subtask
--                 is still 'done' and still counts towards progress).
--
-- Both default to false: nothing is hidden until it is deliberately flagged.
alter table public.subtasks
  add column if not exists is_focused  boolean not null default false,
  add column if not exists is_archived boolean not null default false;

-- The board and task views filter on these constantly. Partial indexes: both
-- flags are false for almost every row and every query asks for the true ones,
-- so indexing only those keeps the index small.
create index if not exists subtasks_is_focused_idx  on public.subtasks (is_focused)  where is_focused;
create index if not exists subtasks_is_archived_idx on public.subtasks (is_archived) where is_archived;
