import type { JSX } from "react";
import { notFound, redirect } from "next/navigation";
import { ApiError, resolveScanTag } from "../../../../lib/api";

type SpaceScanPageProps = {
  params: Promise<{ tag: string }>;
};

export default async function SpaceScanPage({ params }: SpaceScanPageProps): Promise<JSX.Element> {
  const { tag } = await params;

  try {
    const resolved = await resolveScanTag(tag);

    if (resolved.type !== "space") {
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