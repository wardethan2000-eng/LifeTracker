import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { WorkspaceLayout, type WorkspaceTab } from "../../../../components/workspace-layout";
import { ApiError, getMe, getServiceProvider } from "../../../../lib/api";

type ProviderLayoutProps = {
  params: Promise<{ providerId: string }>;
  children: ReactNode;
};

export default async function ServiceProviderLayout({ params, children }: ProviderLayoutProps): Promise<JSX.Element> {
  const { providerId } = await params;

  const me = await getMe();
  const household = me.households[0];

  if (!household) {
    return <>{children}</>;
  }

  let provider;
  try {
    provider = await getServiceProvider(household.id, providerId);
  } catch (error) {
    if (error instanceof ApiError) {
      return <>{children}</>;
    }
    throw error;
  }

  const base = `/service-providers/${provider.id}`;

  const tabs: WorkspaceTab[] = [
    { id: "overview", label: "Overview", href: base },
    { id: "activity", label: "Activity", href: `${base}/activity` },
    { id: "settings", label: "Settings", href: `${base}/settings` },
  ];

  return (
    <WorkspaceLayout
      entityType="provider"
      title={provider.name}
      status={provider.specialty ?? "General"}
      backHref="/service-providers"
      backLabel="All Providers"
      headerActions={
        <span className="pill">{provider.rating ? `${provider.rating}★` : "Unrated"}</span>
      }
      tabs={tabs}
    >
      {children}
    </WorkspaceLayout>
  );
}
