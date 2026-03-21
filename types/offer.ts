import { Timestamp } from "firebase/firestore";

export type OfferAvailability = "sales" | "website";

export interface CreateOfferRequestBody {
  name: string;
  discountPercentage: number;
  startDate: number;
  endDate: number;
  availableOn: OfferAvailability;
  couponIds: string[];
}

export interface OfferCouponEntry {
  couponId: string;
  expirationDate: Timestamp;
}

export interface Offer {
  discountId: string;
  name: string;
  discountPercentage: number;
  startDate: Timestamp;
  endDate: Timestamp;
  availableOn: OfferAvailability;
  coupons: OfferCouponEntry[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
