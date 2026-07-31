import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Next 16 renamed `middleware` to `proxy` (Node runtime only).
 *
 * Two jobs:
 *  1. Refresh the Supabase session cookie on every request, so a token expiring
 *     mid-visit does not log you out.
 *  2. Gate the whole app — this is a single-account tool, so anything other than
 *     /login redirects to /login when signed out.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Revalidates the token; do not replace with getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Come back to where they were heading after signing in.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /**
   * Skip static assets and the PWA files — the manifest, service worker and
   * icons must stay reachable while signed out or the app cannot be installed.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
