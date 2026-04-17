import { redirect } from "next/navigation";

type HobbyCommentsPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyCommentsPage({ params }: HobbyCommentsPageProps): Promise<never> {
  const { hobbyId } = await params;
  redirect(`/hobbies/${hobbyId}/notes`);
}
