import type { FastifyPluginAsync } from "fastify";
import { prisma } from "../db/prisma.js";

export const demoRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", async () => {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        community: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        unit: {
          select: {
            id: true,
            number: true,
            tower: true,
          },
        },
      },
    });
  });
};