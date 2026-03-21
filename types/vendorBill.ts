import { Timestamp } from "firebase/firestore";

export interface VendorBillPayment {
  date: Timestamp;
  amount: number;
}

export interface VendorBill {
  vendorBillId: string;
  billNumber: string;
  customerName: string;
  purchaseOrder: string;
  amountDue: number;
  paidOn: VendorBillPayment[];
  billDate: Timestamp;
  billDue: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
