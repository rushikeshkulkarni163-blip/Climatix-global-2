/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      "api.open-meteo.com",
      "power.larc.nasa.gov",
      "api.reliefweb.int",
      "api.openaq.org",
    ],
  },

  // Expose env vars to client
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
    NEXT_PUBLIC_WS_URL:  process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000/ws/stream",
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
  },

  // Allow rewrites to intelligence engine in development
  async rewrites() {
    const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const TERMINAL_API = process.env.TERMINAL_API_URL ?? "http://localhost:8100";
    return [
      // Climactix Terminal service: same-origin so its httpOnly session cookie applies.
      {
        source: "/cxt-api/:path*",
        destination: `${TERMINAL_API}/api/v1/:path*`,
      },
      {
        source: "/intelligence/:path*",
        destination: `${API_ORIGIN}/:path*`,
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
