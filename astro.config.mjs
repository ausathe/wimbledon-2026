import { defineConfig } from "astro/config";

// GitHub Pages project-page config (URS-63, URS-64): the site is served from
// https://<user>.github.io/wimbledon-2026/ so every internal asset reference
// must go through import.meta.env.BASE_URL rather than an absolute "/".
export default defineConfig({
  site: "https://ausathe.github.io",
  base: "/wimbledon-2026/",
  trailingSlash: "ignore",
  build: {
    assets: "assets",
  },
});
