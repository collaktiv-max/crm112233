import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

const MISSING_ENV_PAGE = `<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Collaktiv CRM – inställning saknas</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">Databasen är inte kopplad</h1>
<p>Appen hittar inte Supabase-inställningarna. Gå till <b>Vercel → Settings → Environment Variables</b> och kontrollera att följande finns:</p>
<ul><li><code>NEXT_PUBLIC_SUPABASE_URL</code></li><li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> eller <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></li></ul>
<p>Gör sedan <b>Deployments → ⋯ → Redeploy</b>.</p></body></html>`;

export async function proxy(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new NextResponse(MISSING_ENV_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  const allowed = user && isAllowedEmail(user.email);

  if (!allowed && !isPublic) {
    if (user) await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = user ? "?fel=behorighet" : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
