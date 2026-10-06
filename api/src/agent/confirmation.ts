export type ConfirmedAction = "SUBMIT" | "CANCEL" | "APPROVE" | "REJECT" | null;

const confirmationPatterns: Array<[Exclude<ConfirmedAction, null>, RegExp]> = [
  ["SUBMIT", /^(?:yes[, ]+)?confirm\s+submit(?:\s+(?:this|the)\s+request)?[.!]?$/i],
  ["CANCEL", /^(?:yes[, ]+)?confirm\s+cancel(?:\s+(?:this|the)\s+request)?[.!]?$/i],
  ["APPROVE", /^(?:yes[, ]+)?confirm\s+approve(?:\s+(?:this|the)\s+request)?[.!]?$/i],
  ["REJECT", /^(?:yes[, ]+)?confirm\s+reject(?:\s+(?:this|the)\s+request)?[.!]?$/i],
];

export function getConfirmedAction(message: string): ConfirmedAction {
  const normalized = message.trim();
  return confirmationPatterns.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
}
