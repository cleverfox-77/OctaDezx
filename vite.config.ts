import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Remove base completely for now to fix routing issues
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy all requests from /api/supabase to actual Supabase
      '/api/supabase': {
        target: 'https://dnjhvfmlmvhabrlpcmao.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/supabase/, ''),
        configure: (proxy, options) => {
          // Log proxy requests for debugging
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔄 Proxying:', req.method, req.url, '→', options.target + proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('✅ Proxy response:', proxyRes.statusCode, req.url);
          });
        },
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Only split packages that are proven safe (no circular deps).
        // react-helmet-async, recharts/d3, @radix-ui, react-hook-form/zod
        // all trigger TDZ crashes when force-split — leave them in their
        // consuming chunk (Dashboard / lazy routes).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // React core — always safe, needed by every chunk
          if (id.includes("react-dom") || id.includes("/react/")) return "vendor";
          // React Router — safe, large, not needed on landing page
          if (id.includes("react-router")) return "router";
          // Supabase — safe, only needed after auth
          if (id.includes("@supabase/")) return "supabase";
          // React Query — safe, only needed after auth
          if (id.includes("@tanstack/react-query")) return "rquery";
          // Lucide icons — safe (just SVG re-exports, no circular deps)
          if (id.includes("lucide-react")) return "icons";
        }
      }
    }
  },
  preview: {
    port: 4173,
    host: true
  }
}));
