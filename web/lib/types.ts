export type Role = "RESIDENT" | "ADMIN";
export type User = {
  name: string;
  email: string;
  role: Role;
  community: string;
  unit: string | null;
};
export type Session = { token: string; user: User };
export type Message = { id: string; role: string; content: string };
export type PolicyCheck = { name: string; result: string; message: string };
export type RequestEvent = {
  id: string;
  type: string;
  data?: { from?: string; to?: string; reason?: string } | null;
  createdAt: string;
};
export type MoveRequest = {
  id: string;
  type: string;
  status: string;
  version: number;
  requestData: Record<string, unknown>;
  resident?: { name: string };
  unit?: { number: string };
  assessments?: { result: string; summary?: string; checks?: PolicyCheck[] }[];
  events?: RequestEvent[];
};
export type Conversation = {
  id: string;
  requestId: string | null;
  updatedAt?: string;
  messages?: Message[];
  request?: { type: string; status: string } | null;
};
