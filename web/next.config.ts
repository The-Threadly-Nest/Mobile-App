import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/admin.html", destination: "/admin", permanent: true },
      { source: "/unsubscribe.html", destination: "/unsubscribe", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] }];
  },
};
export default nextConfig;
