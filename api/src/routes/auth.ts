import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

const loginSchema = z.object({
  email: z.email(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid email",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: parsed.data.email,
      },
      include: {
        community: true,
        unit: true,
      },
    });

    if (!user) {
      return reply.code(401).send({
        error: "Demo user not found",
      });
    }

    const token = app.jwt.sign({
      userId: user.id,
      communityId: user.communityId,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        community: user.community.name,
        unit: user.unit?.number ?? null,
      },
    };
  });
};