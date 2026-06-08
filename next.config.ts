import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(self), microphone=(self), geolocation=()",
        },
        {
          // NOTE: script-src keeps 'unsafe-inline'/'unsafe-eval' because most
          // pages are statically prerendered — their inline bootstrap scripts
          // are emitted at build time and cannot carry a per-request nonce
          // (a nonce CSP would block them). The actual stored-content XSS sink
          // (camp messages) is sanitized with DOMPurify at render instead.
          // form-action / frame-ancestors / object-src / base-uri are the
          // static-rendering-safe hardening we can enforce here.
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com",
            "media-src 'self' blob: https://*.supabase.co",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com https://api.stripe.com https://*.stripe.com",
            "frame-src https://www.instagram.com https://docs.google.com https://js.stripe.com https://*.stripe.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default nextConfig;
