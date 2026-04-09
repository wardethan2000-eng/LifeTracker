import { fileURLToPath } from "node:url";

const resolveFromRoot = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

export default {
  esbuild: {
    jsx: "automatic"
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost"
      }
    },
    include: ["components/**/*.test.tsx", "app/**/*.test.ts", "app/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
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
      "@aegis/presets": resolveFromRoot("../../packages/presets/src/index.ts"),
      "@aegis/types": resolveFromRoot("../../packages/types/src/index.ts"),
      "@aegis/utils": resolveFromRoot("../../packages/utils/src/index.ts")
    }
  }
};