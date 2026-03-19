export type ContactType = "customer" | "vendor" | "both";

import { Timestamp } from "firebase/firestore";

export interface ContactAddress {
  city: string;
  state: string;
  pincode: string;
}

export interface Contact {
  contactId: string;
  name: string;
  type: ContactType;
  email: string;
  mobile: string;
  address: ContactAddress;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
