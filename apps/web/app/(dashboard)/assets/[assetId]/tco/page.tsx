import { redirect } from "next/navigation";

export default async function AssetTcoPage({ params }: { params: Promise<{ assetId: string }> }): Promise<never> {
  const { assetId } = await params;
  redirect(`/assets/${assetId}/costs#asset-tco`);
}
