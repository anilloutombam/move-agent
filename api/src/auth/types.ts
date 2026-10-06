import "@fastify/jwt";
import type { UserRole } from "../generated/prisma/client.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: string;
      communityId: string;
      role: UserRole;
    };
    user: {
      userId: string;
      communityId: string;
      role: UserRole;
    };
  }
}