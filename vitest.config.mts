import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

// Matches tsconfig.json's "@/*": ["./*"] — needed the first time a test
// transitively imports an app/ file (this project's page components use
// "@/lib/..." imports, same convention as every other app/ file; vitest
// has no path-alias resolution without this, unlike Next.js's own build).
export default defineConfig(({ mode }) => {
  // vitest doesn't load .env/.env.local the way Next.js does — the first
  // test to transitively import lib/prisma.ts (any real-data module that
  // touches the CRM) failed with "DATABASE_URL is not set" even though
  // it's right there in .env, because nothing had loaded it into
  // process.env for the test runner. Vite's own loadEnv does this without
  // adding a dotenv dependency; "" as the third arg loads every variable,
  // not just VITE_-prefixed ones.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    resolve: {
      alias: {
        "@": import.meta.dirname,
      },
    },
  };
});
