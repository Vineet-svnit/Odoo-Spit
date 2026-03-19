export type UserRole = "internal" | "portal";

import { Timestamp } from "firebase/firestore";

export interface UserAddress {
  city: string;
  state: string;
  pincode: string;
}

export interface User {
  userId: string;
  name: string;
  role: UserRole;
  email: string;
  mobile: string;
  address: UserAddress;
  contactId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
