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

/**
 * Networking Night sube el CV directo al almacenamiento de Convex, así que su
 * página es la única de la landing que puede conectarse a ese origen.
 */
const origenConvex = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "").origin;
  } catch {
    return "https://*.convex.cloud";
  }
})();
const cspNetworkingNight = cspLanding.replace("connect-src 'self'", `connect-src 'self' ${origenConvex}`);

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
      beforeFiles: [
        { source: "/", destination: "/landing/alpha.html" },
        {
          source: "/eventos/n-night",
          has: [{ type: "header", key: "user-agent", value: "(.*)(Mobi|Android|iPhone|iPod)(.*)" }],
          destination: "/n-night/movil.html",
        },
        { source: "/eventos/n-night", destination: "/n-night/escritorio.html" },
      ],
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
        source: "/dashboard/usuarios",
        destination: "/dashboard/ajustes?seccion=usuarios",
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
        // Todo lo demas (la landing). Excluye /dashboard, /panel y /api con
        // un lookahead negativo: Next aplica TODAS las reglas que coincidan y
        // la ultima gana, asi que un "/:path*" a secas pisaria la CSP
        // estricta del panel con la permisiva de la landing.
        source: "/((?!dashboard|panel|api).*)",
        headers: [...cabecerasComunes, { key: "Content-Security-Policy", value: cspLanding }],
      },
      {
        // Va después de la regla de la landing para que su CSP gane. Fuera de
        // buscadores hasta que se anuncie el evento.
        source: "/:ruta(eventos/n-night|n-night/.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspNetworkingNight },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Vary", value: "User-Agent" },
        ],
      },
      {
        source: "/registro/id",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/dashboard/boletos",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
