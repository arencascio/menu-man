import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRestaurantPublicationRestricted } from "./lib/public-restaurant-access";
import { isManagementOnlyPath, isProductionManagementDisabled } from "./lib/production-management-gate";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const operations = /^\/ops(?:\/|$)/.test(pathname);
  if (operations && process.env.MENU_MAN_OPS_ENABLED !== "true") {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  }
  if (isProductionManagementDisabled() && isManagementOnlyPath(pathname)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  const restaurantPath = pathname.match(/^\/(?:r|api\/restaurants)\/([^/]+)(?:\/|$)/);
  if (restaurantPath) {
    let slug = restaurantPath[1];
    try { slug = decodeURIComponent(slug); } catch { /* Invalid slugs reveal no restaurant. */ }
    if (isRestaurantPublicationRestricted(slug)) {
      return new NextResponse("Not found", {
        status: 404,
        headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
      });
    }
    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  if (operations) {
    await supabase.auth.getUser();
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  } else await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/manage/:path*", "/auth/:path*", "/api/manage/:path*", "/r/:path*", "/api/restaurants/:path*", "/ops/:path*"],
};
