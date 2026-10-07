import { z } from "zod";

export function normalizeDocumentType(document: string): string {
  const normalized = document
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  if (
    normalized.includes("IDENTITY_PROOF") ||
    normalized.includes("DRIVING_LICENCE") ||
    normalized.includes("DRIVING_LICENSE") ||
    normalized.includes("DRIVER_LICENCE") ||
    normalized.includes("DRIVER_LICENSE") ||
    normalized === "PASSPORT" ||
    normalized === "AADHAAR" ||
    normalized === "AADHAR" ||
    normalized === "NATIONAL_ID"
  ) {
    return "IDENTITY_PROOF";
  }

  if (
    normalized.includes("MOVE_OUT_CLEARANCE") ||
    normalized === "CLEARANCE_CERTIFICATE"
  ) {
    return "MOVE_OUT_CLEARANCE";
  }

  return normalized;
}

export const moveRequestDataSchema = z.object({
  moveDate: z.iso.date().optional(),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  vehicleNumber: z.string().trim().min(1).max(30).optional(),
  documents: z
    .array(z.string().trim().min(1).transform(normalizeDocumentType))
    .max(20)
    .transform((documents) => [...new Set(documents)])
    .optional(),
  elevatorBookingRequested: z.boolean().optional(),
});

export type MoveRequestData = z.infer<typeof moveRequestDataSchema>;
