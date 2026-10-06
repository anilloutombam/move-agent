import { prisma } from "../db/prisma.js";
import { canLinkRequest } from "../domain/conversation-access.js";
import { DomainError } from "../domain/errors.js";
import type { MessageRole, Prisma, UserRole } from "../generated/prisma/client.js";

type Actor = {
  userId: string;
  communityId: string;
  role: UserRole;
};

export class ConversationService {
  static async create(actor: Actor, requestId?: string) {
    if (requestId) {
      const request = await prisma.moveRequest.findUnique({
        where: { id: requestId },
        select: { communityId: true, residentId: true },
      });
      if (!request || !canLinkRequest(actor.role, actor.userId, actor.communityId, request)) {
        throw new DomainError("REQUEST_NOT_FOUND");
      }
    }

    return prisma.conversation.create({
      data: { userId: actor.userId, requestId },
      include: {
        request: { select: { id: true, type: true, status: true } },
      },
    });
  }

  static async list(actor: Actor, page: number, limit: number) {
    const where = { userId: actor.userId };
    const [items, total] = await prisma.$transaction([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          request: { select: { id: true, type: true, status: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
      prisma.conversation.count({ where }),
    ]);
    return { items, page, limit, total };
  }

  static async get(actor: Actor, conversationId: string, page: number, limit: number) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: actor.userId },
      include: {
        request: { select: { id: true, type: true, status: true, version: true } },
      },
    });
    if (!conversation) throw new DomainError("CONVERSATION_NOT_FOUND");

    const where = { conversationId };
    const [messages, totalMessages] = await prisma.$transaction([
      prisma.message.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    return { ...conversation, messages, messagePage: page, messageLimit: limit, totalMessages };
  }

  static async addUserMessage(actor: Actor, conversationId: string, content: string) {
    return this.appendMessage(actor, conversationId, "USER", content);
  }

  static async appendAgentMessage(
    actor: Actor,
    conversationId: string,
    role: Exclude<MessageRole, "USER">,
    content: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.appendMessage(actor, conversationId, role, content, metadata);
  }

  private static async appendMessage(
    actor: Actor,
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId, userId: actor.userId },
      });
      if (!conversation) throw new DomainError("CONVERSATION_NOT_FOUND");

      const message = await tx.message.create({
        data: { conversationId, role, content, metadata },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return message;
    });
  }
}
