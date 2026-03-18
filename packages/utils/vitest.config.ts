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
      reportsDirectory: "./coverage"
    }
  },
  resolve: {
    alias: {
      "@lifekeeper/types": resolveFromRoot("../types/src/index.ts")
    }
  }
};