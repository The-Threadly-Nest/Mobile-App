export type Audience = "customer" | "fashion_house";
export type WaitlistStatus = "waiting" | "invited" | "joined" | "unsubscribed";
export type AudienceFilter = Audience | "all";
export type StatusFilter = WaitlistStatus | "all";

export interface JoinWaitlistInput {
  name: string;
  email: string;
  audience: Audience;
  city: string;
  phone: string;
  businessName?: string;
  teamSize?: string;
  instagram?: string;
  interests?: string;
  website: string;
  consent: boolean;
  referredBy?: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  name: string;
  audience: Audience;
  businessName: string | null;
  city: string | null;
  status: WaitlistStatus;
  verifiedAt: string | null;
  createdAt: string;
}

export interface WaitlistResponse {
  entries: WaitlistEntry[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary: { total: number; customers: number; fashionHouses: number; waiting: number; invited: number; joined: number };
}

export interface MessageResponse { message: string }
export interface VerifyResponse extends MessageResponse { referralCode: string }
export interface InviteResponse { delivered: string[]; failed: string[] }
