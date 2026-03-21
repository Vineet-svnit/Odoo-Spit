import { Timestamp } from "firebase/firestore";

export type BillPaymentType = "send" | "receive";
export type BillPaymentPartnerType = "customer" | "vendor";

export interface CreatePaymentBillRequestBody {
  vendorBillId: string;
  paymentType: BillPaymentType;
  partnerType: BillPaymentPartnerType;
  partnerName: string;
  amount: number;
}

export interface PaymentBill {
  paymentBillId: string;
  payId: string;
  vendorBillId: string;
  paymentType: BillPaymentType;
  partnerType: BillPaymentPartnerType;
  partnerName: string;
  amount: number;
  paymentDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
