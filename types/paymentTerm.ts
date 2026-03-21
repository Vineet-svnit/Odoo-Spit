import { Timestamp } from "firebase/firestore";

export type EarlyPayDiscountComputation = "base_amount" | "total_amount";

export interface CreatePaymentTermRequestBody {
  name: string;
  early_payment_discount: boolean;
  discount_percentage?: number;
  discount_days?: number;
  early_pay_discount_computation?: EarlyPayDiscountComputation;
  example_preview?: string;
}

export interface PaymentTerm {
  termId: string;
  name: string;
  early_payment_discount: boolean;
  discount_percentage: number | null;
  discount_days: number | null;
  early_pay_discount_computation: EarlyPayDiscountComputation | null;
  example_preview: string;
  isWebsiteDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
