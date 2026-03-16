import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import { ApiError, lookupAssetByTag } from "../../../lib/api";

type AssetScanPageProps = {
  params: Promise<{ tag: string }>;
};

export default async function AssetScanPage({ params }: AssetScanPageProps): Promise<JSX.Element> {
  const { tag } = await params;

  try {
    const asset = await lookupAssetByTag(tag);
    redirect(`/assets/${asset.id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}