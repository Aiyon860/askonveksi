import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

/**
 * Teruskan pathname saat ini ke Server Component lewat header `x-pathname`.
 * Layout `(app)` memakainya untuk memilih aturan akses halaman (403), jadi
 * keputusan akses tetap satu tempat tanpa menduplikasi daftar rute di sini.
 */
function nextWithPathname(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

/**
 * Path dan auth user id diteruskan ke Server Component lewat header.
 * `x-user-id` dipakai mesin scoping brand: cookie brand hanya dipercaya bila
 * terikat ke user yang sedang login.
 */
function nextWithRequestContext(request: NextRequest, userId: string | null) {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  if (userId) headers.set("x-user-id", userId);
  else headers.delete("x-user-id");
  return NextResponse.next({ request: { headers } });
}

export default async function middleware(request: NextRequest) {
  let responseUserId: string | null = null;
  let response = nextWithPathname(request);
  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        // Header `x-pathname` disusun ulang dari request terbaru agar cookie
        // hasil refresh sesi tidak hilang saat response diganti.
        response = nextWithRequestContext(request, responseUserId);

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claimsUserId = data?.claims?.sub;
  responseUserId = typeof claimsUserId === "string" ? claimsUserId : null;
  response = nextWithRequestContext(request, responseUserId);
  return response;
}

export const config = {
  // Kecualikan landing/login/health dari getClaims agar hemat CPU 1vCPU untuk traffic publik + polling SWR.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|$|login|api/(?:whatsapp/health|ai|mcp)).*)"],
};
