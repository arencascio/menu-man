import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRestaurantPublicationRestricted } from "./lib/public-restaurant-access";
import { isManagementOnlyPath, isProductionManagementDisabled } from "./lib/production-management-gate";
import {
  isUpperCrustConceptPage, isUpperCrustUnapprovedMediaPath, upperCrustLocalAllowed,
  upperCrustPreviewAllowed, upperCrustProtectedMediaRequestAllowed,
} from "./lib/upper-crust/access";
import { isUpperCrustReferencePath } from "./lib/upper-crust/reference-media";
import { isUpperCrustProtectedMediaPath } from "./lib/upper-crust/protected-media";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const unapprovedMediaPath = isUpperCrustUnapprovedMediaPath(pathname)
    || (pathname === "/_next/image" && (() => {
      const source = request.nextUrl.searchParams.get("url");
      if (!source) return false;
      try { return isUpperCrustUnapprovedMediaPath(new URL(source, request.nextUrl.origin).pathname); }
      catch { return false; }
    })());
  const optimizedProtectedMediaPath = pathname === "/_next/image" && (() => {
    const source = request.nextUrl.searchParams.get("url");
    if (!source) return false;
    try { return isUpperCrustProtectedMediaPath(new URL(source, request.nextUrl.origin).pathname); }
    catch { return false; }
  })();
  if (optimizedProtectedMediaPath || (unapprovedMediaPath && (process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV)))) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" },
    });
  }
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
    if (slug === "upper-crust") {
      const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer" };
      const host = request.headers.get("host") || "";
      const allowedPage = isUpperCrustConceptPage(pathname)
        && ["GET", "HEAD"].includes(request.method)
        && (upperCrustLocalAllowed(process.env, host) || upperCrustPreviewAllowed(process.env, host));
      // Reference photos remain local-only until publication rights are recorded.
      const allowedLocalMedia = ["GET", "HEAD"].includes(request.method)
        && isUpperCrustReferencePath(pathname)
        && upperCrustLocalAllowed(process.env, host);
      const allowedProtectedMedia = upperCrustProtectedMediaRequestAllowed(process.env, host, pathname, request.method);
      // No concept API access, including order and availability endpoints.
      if (!allowedPage && !allowedLocalMedia && !allowedProtectedMedia) {
        return new NextResponse("Not found", { status: 404, headers });
      }
      const response = NextResponse.next({ request });
      for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      return response;
    }
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
  matcher: ["/manage/:path*", "/auth/:path*", "/api/manage/:path*", "/r/:path*", "/api/restaurants/:path*", "/ops/:path*", "/img/:path*", "/_next/image"],
};
