import { redirect } from "next/navigation";

export default async function HobbyEntriesPage({ params }: { params: Promise<{ hobbyId: string }> }): Promise<never> {
  const { hobbyId } = await params;
  redirect(`/hobbies/${hobbyId}/notes`);
}
