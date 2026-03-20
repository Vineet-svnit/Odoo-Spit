import { Timestamp } from "firebase/firestore";

export interface Material {
  materialId: string;
  name: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
