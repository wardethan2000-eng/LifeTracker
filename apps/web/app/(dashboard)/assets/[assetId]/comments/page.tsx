import { redirect } from "next/navigation";

type AssetCommentsPageProps = {
  params: Promise<{ assetId: string }>;
};

export default async function AssetCommentsPage({ params }: AssetCommentsPageProps): Promise<never> {
  const { assetId } = await params;
  redirect(`/assets/${assetId}/notes`);
}
