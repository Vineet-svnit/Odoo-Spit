import { Timestamp } from "firebase/firestore";

export interface Product {
  productId: string;
  productName: string;
  productCategory: string;
  productType: string;
  material: string;
  colors: string[];
  currentStock: number;
  salesPrice: number;
  salesTax: number;
  purchasePrice: number;
  purchaseTax: number;
  published: boolean;
  images: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
