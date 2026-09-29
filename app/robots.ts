import { MetadataRoute } from "next";

const BASE_URL = "https://featuresalon.co.uk";

const DISALLOW_PATHS = [
  "/dashboard", "/dashboard/", "/admin", "/admin/",
  "/api/", "/book/", "/payment/", "/reschedule/",
  "/subscribe/", "/reset-password", "/salons/debug",
];

const ALLOW_PATHS = [
  "/", "/pricing", "/signup", "/login",
  "/partner", "/blog", "/blog/", "/salons/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── All crawlers ─────────────────────────────────────────
      { userAgent: "*",               allow: ALLOW_PATHS, disallow: DISALLOW_PATHS },
      // ── Google (full crawl) ───────────────────────────────────
      { userAgent: "Googlebot",       allow: "/", disallow: DISALLOW_PATHS },
      { userAgent: "Google-Extended", allow: "/", disallow: DISALLOW_PATHS },
      // ── Bing ─────────────────────────────────────────────────
      { userAgent: "Bingbot",         allow: "/", disallow: DISALLOW_PATHS },

      // ── Block AI scrapers ─────────────────────────────────────
      { userAgent: "GPTBot",          disallow: "/" },
      { userAgent: "ChatGPT-User",    disallow: "/" },
      { userAgent: "CCBot",           disallow: "/" },
      { userAgent: "anthropic-ai",    disallow: "/" },
      { userAgent: "Claude-Web",      disallow: "/" },
      { userAgent: "PerplexityBot",   disallow: "/" },
      { userAgent: "Omgilibot",       disallow: "/" },
      { userAgent: "FacebookBot",     disallow: "/" },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
