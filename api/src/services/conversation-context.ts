import { prisma } from "../db/prisma.js";
import { DomainError } from "../domain/errors.js";
import type {
  MessageRole,
  Prisma,
  UserRole,
} from "../generated/prisma/client.js";
import { parseCommunityPolicy } from "../policy/config.js";

type ContextMessage = {
  role: MessageRole;
  content: string;
  metadata: Prisma.JsonValue | null;
};

function hasToolCalls(metadata: Prisma.JsonValue | null): boolean {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    Array.isArray(metadata.toolCalls)
  );
}

export function compactConversationMessages(
  messages: ContextMessage[],
  limit = 12,
): ContextMessage[] {
  return messages
    .filter((message) => {
      if (!message.content.trim()) return false;
      if (message.role === "USER") return true;
      return message.role === "ASSISTANT" && !hasToolCalls(message.metadata);
    })
    .slice(-Math.max(limit, 1));
}

export class ConversationContextService {
  static async load({
    conversationId,
    userId,
    communityId,
    role,
    messageLimit = 12,
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
          take: Math.min(Math.max(messageLimit * 4, 20), 100),
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
      messages: compactConversationMessages(
        conversation.messages.reverse(),
        messageLimit,
      ),
    };
  }
}
