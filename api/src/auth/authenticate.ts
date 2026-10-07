import type { FastifyRequest } from "fastify";

import "./types.js";

export async function authenticate(request: FastifyRequest) {
  await request.jwtVerify();
}
