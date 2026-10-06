import type { UserRole } from "../generated/prisma/client.js";

type RequestIdentity = {
  communityId: string;
  residentId: string;
};

export function canLinkRequest(
  role: UserRole,
  userId: string,
  communityId: string,
  request: RequestIdentity,
): boolean {
  if (request.communityId !== communityId) return false;
  return role === "ADMIN" || request.residentId === userId;
}
