import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // `server-only` throws when imported outside a Server Component, so it is
      // stubbed for the pure domain/export functions under test.
      "server-only": path.resolve(root, "test/server-only-stub.ts"),
      "@": root,
    },
  },
});
