import { redirect } from "next/navigation";

type HobbySectionPageProps = {
  params: Promise<{ hobbyId: string }>;
};

export default async function HobbyInventoryPage({ params }: HobbySectionPageProps): Promise<never> {
  const { hobbyId } = await params;
  redirect(`/hobbies/${hobbyId}/collection#hobby-links`);
}
