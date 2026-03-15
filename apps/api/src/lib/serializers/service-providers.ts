import type { ServiceProvider } from "@prisma/client";
import { serviceProviderSchema } from "@lifekeeper/types";

export const toServiceProviderResponse = (
  provider: Pick<ServiceProvider, "id" | "householdId" | "name" | "specialty" | "phone" | "email" | "website" | "address" | "rating" | "notes" | "createdAt" | "updatedAt">
) => serviceProviderSchema.parse({
  ...provider,
  createdAt: provider.createdAt.toISOString(),
  updatedAt: provider.updatedAt.toISOString()
});