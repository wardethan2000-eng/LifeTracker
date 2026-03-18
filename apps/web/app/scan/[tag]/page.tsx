import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import { ApiError, lookupAssetByTag, resolveScanTag } from "../../../lib/api";

type AssetScanPageProps = {
  params: Promise<{ tag: string }>;
};

export default async function AssetScanPage({ params }: AssetScanPageProps): Promise<JSX.Element> {
  const { tag } = await params;

  try {
    const asset = await lookupAssetByTag(tag);
    redirect(`/assets/${asset.id}`);
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      try {
        const resolved = await resolveScanTag(tag);
        redirect(resolved.url);
      } catch (resolveError) {
        if (resolveError instanceof ApiError && resolveError.status === 404) {
          notFound();
        }

        throw resolveError;
      }
    }

    throw error;
  }
}