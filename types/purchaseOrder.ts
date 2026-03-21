import { Timestamp } from "firebase/firestore";

export interface PurchaseOrderLineItem {
  product: string;
  qty: number;
  unitPrice: number;
  tax: number;
  taxAmount: number;
  total: number;
}

export interface CreatePurchaseOrderRequestBody {
  vendorId: string;
  poNumber: string;
  order: PurchaseOrderLineItem[];
  totalUntaxed: number;
  totalTaxed: number;
}

export interface PurchaseOrder {
  purchaseOrderId: string;
  vendorId: string;
  poNumber: string;
  poDate: Timestamp;
  order: PurchaseOrderLineItem[];
  totalUntaxed: number;
  totalTaxed: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
