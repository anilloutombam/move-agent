import { z } from "zod";

export const moveRequestDataSchema = z.object({
  moveDate: z.iso.date().optional(),
  preferredTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  vehicleNumber: z.string().trim().min(1).max(30).optional(),
  documents: z.array(z.string().trim().min(1)).max(20).optional(),
  elevatorBookingRequested: z.boolean().optional(),
});

export type MoveRequestData = z.infer<typeof moveRequestDataSchema>;
