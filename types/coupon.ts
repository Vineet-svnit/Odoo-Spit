import { Timestamp } from "firebase/firestore";

export type CouponTarget = "anonymous" | "selected";

export type CouponStatus = "unused" | "used";

export interface CreateCouponRequestBody {
  for: CouponTarget;
  contacts?: string[];
  quantity?: number;
  validUntil: number;
}

export interface Coupon {
  couponId: string;
  code: string;
  expirationDate: Timestamp;
  status: CouponStatus;
  contactId: string | null;
  discountId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
