import type { NextConfig } from "next";

/**
 * El panel corre con una CSP estricta; la landing necesita una mas permisiva
 * porque es HTML artesanal con <script> y <style> en linea y Google Fonts.
 * Tailwind se compila durante el build y se sirve desde este dominio. Separar ambas por ruta evita relajar la
 * politica del panel, que es donde hay datos personales.
 */
const cspLanding = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const cabecerasComunes = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/landing/alpha.html" }],
      afterFiles: [],
      fallback: [],
    };
  },

  async redirects() {
    return [
      {
        source: "/dashboard/programa",
        destination: "/dashboard/eventos/programa",
        permanent: true,
      },
      {
        source: "/panel/:path*",
        destination: "/dashboard/:path*",
        permanent: true,
      },
      {
        source: "/eventos/mario-kart",
        destination: "/events/mario-kart",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/dashboard/:path*",
        headers: [
          ...cabecerasComunes,
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          ...cabecerasComunes,
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      {
        // Todo lo demas (la landing). Excluye /dashboard, /panel y /api con un lookahead
        // negativo: Next aplica TODAS las reglas que coincidan y la ultima
        // gana, asi que un "/:path*" a secas pisaria la CSP estricta del panel
        // con la permisiva de la landing.
        source: "/((?!dashboard|panel|api).*)",
        headers: [...cabecerasComunes, { key: "Content-Security-Policy", value: cspLanding }],
      },
    ];
  },
};

export default nextConfig;
