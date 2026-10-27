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

export default async function middleware(request: NextRequest) {
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
        response = nextWithPathname(request);

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Kecualikan landing/login/health dari getClaims agar hemat CPU 1vCPU untuk traffic publik + polling SWR.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|$|login|api/whatsapp/health).*)"],
};
