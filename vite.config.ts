import { defineConfig } from "vite";

export default defineConfig({
  base: "./",

  assetsInclude: ["**/*.frag", "**/*.vert"],

  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    watch: {
      usePolling: true,
    },
  },
});
