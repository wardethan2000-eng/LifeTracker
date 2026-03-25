import { fileURLToPath } from "node:url";

const resolveFromRoot = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

export default {
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
      // Enforce a minimum floor — tighten these upward over time as coverage improves.
      // These are calibrated to the existing suite; if CI fails here, a regression occurred.
      thresholds: {
        lines: 22,
        functions: 44,
        branches: 40,
        statements: 22
      }
    }
  },
  resolve: {
    alias: {
      "@lifekeeper/presets": resolveFromRoot("../../packages/presets/src/index.ts"),
      "@lifekeeper/types": resolveFromRoot("../../packages/types/src/index.ts"),
      "@lifekeeper/utils": resolveFromRoot("../../packages/utils/src/index.ts")
    }
  }
};