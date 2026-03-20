import { Timestamp } from "firebase/firestore";

export interface ProductCategory {
  categoryId: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
