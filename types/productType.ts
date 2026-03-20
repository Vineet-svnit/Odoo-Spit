import { Timestamp } from "firebase/firestore";

export interface ProductType {
  typeId: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
