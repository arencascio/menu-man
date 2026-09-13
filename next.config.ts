import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const squarePaymentCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://sandbox.web.squarecdn.com",
      "style-src 'self' 'unsafe-inline' https://*.squarecdn.com",
      "connect-src 'self' https://*.squareupsandbox.com https://*.squarecdn.com",
      "frame-src 'self' https://*.squareupsandbox.com https://*.squarecdn.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://*.squarecdn.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ");
    return [{
      source: "/r/:slug/order/:orderId/payment",
      headers: [{ key: "Content-Security-Policy", value: squarePaymentCsp }],
    }];
  },
};

export default nextConfig;
