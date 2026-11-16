import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "node", include: ["test/**/*.test.ts"], exclude: ["test/embed.test.ts"], environment: "node" } },
      { test: { name: "dom", include: ["test/embed.test.ts"], environment: "jsdom", setupFiles: ["test/setup.ts"] } },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/cli.ts"],
      reporter: ["text-summary"],
      thresholds: { statements: 98, branches: 93, functions: 99, lines: 99 },
    },
  },
});
