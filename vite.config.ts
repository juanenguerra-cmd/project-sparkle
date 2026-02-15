import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Cloudflare Pages + Vite + React
 * - SPA-safe (pair with public/_redirects)
 * - Deterministic dev server behavior
 * - Optional sourcemaps for production debugging
 */
export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const isProd = mode === "production";

  return {
    // If you ever deploy under a subpath (e.g., /icn-hub/), set:
    // base: isProd ? "/icn-hub/" : "/",

    plugins: [react(), isDev && componentTagger()].filter(Boolean),

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    server: {
      // More predictable across mac/windows/lan; avoids IPv6-only oddities
      host: true,
      port: 8080,
      strictPort: true,
      hmr: { overlay: false },
    },

    preview: {
      host: true,
      port: 8080,
      strictPort: true,
    },

    build: {
      // Helpful for diagnosing production issues. If you don't want
      // sourcemaps in prod, change to: sourcemap: isDev
      sourcemap: true,

      // Keeps output more cache-friendly on Cloudflare CDN
      assetsInlineLimit: 0,

      rollupOptions: {
        output: {
          /**
           * Split chunky dependencies so:
           * - initial load is faster
           * - Cloudflare caches vendor chunks longer
           */
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            ui: [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tooltip",
            ],
            data: ["@tanstack/react-query", "zod"],
            exports: ["xlsx", "docx", "jspdf", "jspdf-autotable"],
          },
        },
      },
    },

    optimizeDeps: {
      // Helps Vite prebundle these consistently in dev
      include: ["react", "react-dom", "react-router-dom"],
    },

    define: {
      // Optional: convenient flag if you want to gate dev-only behaviors
      __DEV__: JSON.stringify(isDev),
      __PROD__: JSON.stringify(isProd),
    },
  };
});