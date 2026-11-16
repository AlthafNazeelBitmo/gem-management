import process from "node:process";
import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "127.0.0.1",
    proxy: { "/api": process.env.GEM_API_PROXY || "http://127.0.0.1:3001" },
  },
});
