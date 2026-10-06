import { z } from "zod";

import { DomainError } from "../domain/errors.js";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const communityPolicyConfigSchema = z.object({
  noticeHours: z.number().int().nonnegative(),
  movingHours: z.object({
    start: timeSchema,
    end: timeSchema,
  }),
  elevatorBookingRequired: z.boolean(),
  requiredDocuments: z.object({
    MOVE_IN: z.array(z.string().min(1)),
    MOVE_OUT: z.array(z.string().min(1)),
  }),
  maxMovesPerSlot: z.number().int().positive(),
  adminApprovalRequired: z.boolean(),
}).superRefine((policy, context) => {
  if (policy.movingHours.start >= policy.movingHours.end) {
    context.addIssue({
      code: "custom",
      message: "Moving-hours start must be before end",
      path: ["movingHours"],
    });
  }
});

export type CommunityPolicyConfig = z.infer<typeof communityPolicyConfigSchema>;

export function parseCommunityPolicy(config: unknown): CommunityPolicyConfig {
  const parsed = communityPolicyConfigSchema.safeParse(config);
  if (!parsed.success) {
    throw new DomainError("INVALID_POLICY_CONFIG", { issues: parsed.error.issues });
  }
  return parsed.data;
}
