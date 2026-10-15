import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` path mapping in tsconfig.json.
      "@": root,
      // `server-only` is a Next.js build-time guard; stub it for Node test runs.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NEXT_PUBLIC_TMDB_PROXY_BASE: "https://mtd.example.test",
      NEXT_PUBLIC_TMDB_API_KEY: "test-key",
    },
  },
});
