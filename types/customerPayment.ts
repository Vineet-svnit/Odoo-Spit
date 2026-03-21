import { Timestamp } from "firebase/firestore";

export type CustomerPaymentType = "receive";
export type CustomerPaymentPartnerType = "customer";

export interface CreateCustomerPaymentRequestBody {
  customerInvoiceId: string;
  paymentType: CustomerPaymentType;
  partnerType: CustomerPaymentPartnerType;
  partnerName: string;
  amount: number;
}

export interface CustomerPayment {
  customerPaymentId: string;
  payId: string;
  customerInvoiceId: string;
  paymentType: CustomerPaymentType;
  partnerType: CustomerPaymentPartnerType;
  partnerName: string;
  amount: number;
  paymentDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
