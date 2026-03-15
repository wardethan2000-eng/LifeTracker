import type { Hobby, PrismaClient } from "@prisma/client";

export const getAccessibleHobby = async (
  prisma: PrismaClient,
  hobbyId: string,
  userId: string
): Promise<Hobby | null> =>
  prisma.hobby.findFirst({
    where: {
      id: hobbyId,
      household: {
        members: {
          some: {
            userId
          }
        }
      }
    }
  });
