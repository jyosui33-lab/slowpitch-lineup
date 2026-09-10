import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Must match the actual GitHub repository name exactly (case-sensitive).
// This only affects the production build used for GitHub Pages — the local
// dev server always runs at "/", so `npm run dev` is unaffected no matter
// what this is set to.
const GITHUB_REPO_NAME = "slowpitch-lineup";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? `/${GITHUB_REPO_NAME}/` : "/",
  server: {
    host: true, // lets you open the dev server from your iPhone on the same wifi
  },
}));
