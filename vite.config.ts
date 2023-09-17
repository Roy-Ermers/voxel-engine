import { defineConfig } from "vite";

export default defineConfig({
  base: "./",

  assetsInclude: ["**/*.frag", "**/*.vert"],

  server: {
    watch: {
      usePolling: true,
    },
  },
});
