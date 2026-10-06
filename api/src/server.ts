import "dotenv/config";
import Fastify from "fastify";
import jwt from "@fastify/jwt";

import { authRoutes } from "./routes/auth.js";
import { demoRoutes } from "./routes/demo.js";
import { residentRoutes } from "./routes/resident.js";
import { adminRoutes } from "./routes/admin.js";
import { conversationRoutes } from "./routes/conversations.js";

const app = Fastify({
  logger: true,
});

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is not configured");
}

await app.register(jwt, {
  secret: jwtSecret,
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "move-in-move-out-api",
  };
});

await app.register(authRoutes, {
  prefix: "/auth",
});

await app.register(residentRoutes, {
  prefix: "/resident",
});

await app.register(adminRoutes, {
  prefix: "/admin",
});

await app.register(conversationRoutes, {
  prefix: "/conversations",
});

await app.register(demoRoutes, {
  prefix: "/demo",
});


const start = async () => {
  try {
    await app.listen({
      port: 4000,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
