import { Timestamp } from "firebase/firestore";

import type { SelectedCoupon } from "@/types/saleOrder";

export interface CustomerInvoicePayment {
  date: Timestamp;
  amount: number;
}

export interface InvoiceCouponLine {
  offerId: string;
  couponId: string;
  offerName: string;
  couponCode: string;
  discountPercentage: number;
  discountAmount: number;
}

export interface CreateCustomerInvoiceRequestBody {
  saleOrderId: string;
  paymentTermId: string;
  selectedCoupons: SelectedCoupon[];
}

export interface CustomerInvoice {
  customerInvoiceId: string;
  invoiceNumber: string;
  customerName: string;
  saleOrderId: string;
  paymentTermId: string | null;
  subtotalUntaxed: number;
  subtotalTaxed: number;
  couponDiscountTotal: number;
  couponLines: InvoiceCouponLine[];
  amountDue: number;
  paidOn: CustomerInvoicePayment | null;
  invoiceDate: Timestamp;
  invoiceDue: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
