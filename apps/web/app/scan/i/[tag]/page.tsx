import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import { ApiError, resolveScanTag } from "../../../../lib/api";

type InventoryItemScanPageProps = {
  params: Promise<{ tag: string }>;
};

export default async function InventoryItemScanPage({ params }: InventoryItemScanPageProps): Promise<JSX.Element> {
  const { tag } = await params;

  try {
    const resolved = await resolveScanTag(tag);

    if (resolved.type !== "inventory_item") {
      notFound();
    }

    redirect(resolved.url);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}