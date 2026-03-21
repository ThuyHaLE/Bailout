import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/machines":      "http://localhost:8000",
      "/orders":        "http://localhost:8000",
      "/recommend":     "http://localhost:8000",
    }
  }
});