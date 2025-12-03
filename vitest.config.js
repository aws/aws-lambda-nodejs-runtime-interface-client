import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "integration-tests/tests/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "cobertura"],
      exclude: [
        "**/Dockerfile.js",
        "**/*.config.js",
        "dist",
        "integration-tests",
        "coverage",
        "resources",
        "scripts",
        "index.mjs",
      ],
    },
    server: {
      deps: {
        // This tells vitest to not compile /integration-tests/test-files since they're sensitive to bundling changes
        external: [/\/node_modules\//, /\/integration-tests\/test-files\/.*/],
      },
    },
  },
});
