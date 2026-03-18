import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../node_modules/@colyseus/schema/build/cjs/index.js");

export default defineConfig({
  envDir: path.resolve(__dirname, ".."),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "chess2d-shared": path.resolve(__dirname, "../shared/src"),
      "@colyseus/schema": schemaPath,
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
