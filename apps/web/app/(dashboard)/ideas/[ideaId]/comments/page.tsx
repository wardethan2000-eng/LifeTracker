import { redirect } from "next/navigation";

type IdeaCommentsPageProps = {
  params: Promise<{ ideaId: string }>;
};

export default async function IdeaCommentsPage({ params }: IdeaCommentsPageProps): Promise<never> {
  const { ideaId } = await params;
  redirect(`/ideas/${ideaId}/notes`);
}
