/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  // SECURITY: don't reveal the framework in the X-Powered-By header.
  poweredByHeader: false,

  // SECURITY: don't ship source maps to the browser in production
  // (they would re-expose original source, defeating minification).
  productionBrowserSourceMaps: false,

  // SECURITY: strip console.* calls from the production client bundle
  // (they often leak API URLs, request payloads, internal flags).
  // Keep console.error so real failures still surface in the browser.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },

  // SECURITY: HTTP security headers applied to every response.
  // Note: no strict CSP here — the builder relies on esbuild-wasm (blob: Web Worker)
  // and an in-browser iframe preview which require relaxed script/frame policies.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent this app from being embedded in iframes on other origins.
          // SAMEORIGIN (not DENY) because the builder preview uses a same-origin iframe.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Block MIME-type sniffing attacks.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Only send full referrer to same origin; just the origin to cross-origin HTTPS.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable access to sensitive browser APIs not needed by the builder.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // HSTS: force HTTPS for 1 year once seen (the reverse proxy handles the TLS handshake).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  reactStrictMode: false,
};

export default nextConfig
