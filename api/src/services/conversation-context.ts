import { prisma } from "../db/prisma.js";
import { DomainError } from "../domain/errors.js";
import type { UserRole } from "../generated/prisma/client.js";
import { parseCommunityPolicy } from "../policy/config.js";

export class ConversationContextService {
  static async load({
    conversationId,
    userId,
    communityId,
    role,
    messageLimit = 30,
  }: {
    conversationId: string;
    userId: string;
    communityId: string;
    role: UserRole;
    messageLimit?: number;
  }) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        user: {
          include: {
            community: true,
            unit: true,
          },
        },
        request: {
          include: {
            unit: true,
            assessments: { orderBy: { createdAt: "desc" }, take: 1 },
            events: { orderBy: { createdAt: "desc" }, take: 20 },
          },
        },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: Math.min(Math.max(messageLimit, 1), 100),
        },
      },
    });

    if (
      !conversation ||
      conversation.user.communityId !== communityId ||
      conversation.user.role !== role
    ) {
      throw new DomainError("CONVERSATION_NOT_FOUND");
    }

    const policyVersion = conversation.request?.configVersion;
    const policyRecord = policyVersion
      ? await prisma.communityPolicy.findUnique({
          where: { communityId_version: { communityId, version: policyVersion } },
        })
      : await prisma.communityPolicy.findFirst({
          where: { communityId, active: true },
          orderBy: { version: "desc" },
        });

    if (!policyRecord) throw new DomainError("ACTIVE_POLICY_NOT_FOUND");

    return {
      actor: {
        id: conversation.user.id,
        name: conversation.user.name,
        role: conversation.user.role,
        community: conversation.user.community,
        unit: conversation.user.unit,
      },
      conversation: {
        id: conversation.id,
        requestId: conversation.requestId,
      },
      request: conversation.request,
      policy: {
        version: policyRecord.version,
        config: parseCommunityPolicy(policyRecord.config),
      },
      messages: conversation.messages.reverse(),
    };
  }
}
