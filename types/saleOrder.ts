import { Timestamp } from "firebase/firestore";

export interface SaleOrderLineItem {
  product: string;
  qty: number;
  unitPrice: number;
  tax: number;
  taxAmount: number;
  total: number;
}

export interface SelectedCoupon {
  offerId: string;
  couponId: string;
}

export interface CreateSaleOrderRequestBody {
  customerId: string;
  order: SaleOrderLineItem[];
  totalUntaxed: number;
  totalTaxed: number;
  paymentTermId?: string | null;
  selectedCoupons?: SelectedCoupon[];
}

export interface SaleOrder {
  saleOrderId: string;
  customerId: string;
  soNumber: string;
  soDate: Timestamp;
  order: SaleOrderLineItem[];
  totalUntaxed: number;
  totalTaxed: number;
  paymentTermId: string | null;
  selectedCoupons: SelectedCoupon[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
