import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: "client",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "chess2d-shared": path.resolve(__dirname, "shared/src"),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
});
