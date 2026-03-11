import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(currentDirectory, "../../")
};

export default nextConfig;