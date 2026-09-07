import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          graph: ["cytoscape"],
          map: ["leaflet"],
          database: ["dexie", "dexie-react-hooks"],
        },
      },
    },
  },
});
