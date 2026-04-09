import { householdInvitationSchema } from "@aegis/types";

export const toInvitationResponse = (invitation: {
  id: string;
  householdId: string;
  invitedByUserId: string;
  email: string;
  status: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) => householdInvitationSchema.parse({
  id: invitation.id,
  householdId: invitation.householdId,
  invitedByUserId: invitation.invitedByUserId,
  email: invitation.email,
  status: invitation.status,
  token: invitation.token,
  expiresAt: invitation.expiresAt.toISOString(),
  acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
  acceptedByUserId: invitation.acceptedByUserId,
  createdAt: invitation.createdAt.toISOString(),
  updatedAt: invitation.updatedAt.toISOString()
});