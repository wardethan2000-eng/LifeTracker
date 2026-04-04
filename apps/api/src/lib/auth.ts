import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

// Separate PrismaClient for BetterAuth so it manages its own connection lifecycle.
const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  baseURL: process.env.APP_BASE_URL ?? "http://localhost:4000",
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production",

  trustedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim()),

  emailAndPassword: {
    enabled: true,
  },

  // Map BetterAuth's field names to our Prisma schema column names.
  user: {
    modelName: "user",
    fields: {
      name: "displayName",
    },
  },
  session: {
    modelName: "authSession",
  },
  account: {
    modelName: "authAccount",
  },
  verification: {
    modelName: "authVerification",
  },
});
