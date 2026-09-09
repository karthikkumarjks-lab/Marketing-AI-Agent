import { defineConfig } from "vitest/config";

// Matches tsconfig.json's "@/*": ["./*"] — needed the first time a test
// transitively imports an app/ file (this project's page components use
// "@/lib/..." imports, same convention as every other app/ file; vitest
// has no path-alias resolution without this, unlike Next.js's own build).
export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
});
