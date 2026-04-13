#  Odoo-Spit: High-Performance Enterprise ERP & Client Portal

Odoo-Spit is a sophisticated, full-stack business management engine built on **Next.js 15 (App Router)** and **Firebase Firestore**. Designed to handle complex, multi-tenant workflows, the platform bridges the gap between internal ERP operations and an external-facing customer portal. The architecture emphasizes transactional integrity, role-based security, and real-time data synchronization.

---

##  Technical Architecture & Workflows

### 1. **Automated Financial Intelligence**
Odoo-Spit implements a "Zero-Touch" invoicing engine.
- **Auto-Invoicing Engine**: A global configuration toggle (`financeSettings/autoInvoicing`) orchestrates the relationship between Sales and Finance. When enabled, the system intercepts `Sale Order` creation and triggers an immediate, transactional creation of a `Customer Invoice` via Firestore `Write Batches`.
- **Dynamic Payment Logic**: Supports multi-tiered **Payment Terms** (e.g., 50% Advance, 30 Days Net, Immediate). The system calculates discount windows and due dates programmatically based on the `invoiceDate` and term metadata.
- **Sales-to-Invoice Mapping**: Implements deep copying of line items from `Sale Orders` to `Invoices`, maintaining bi-directional references (`saleOrderId` and `invoiceId`) for full auditability.

### 2. **Advanced Coupon & Marketing Engine**
A dual-mode coupon validation system handles high-concurrency discount applications.
- **Anonymous vs. Targeted Coupons**:
    - **Anonymous**: Generated in bulk with a specific `quantity` pool for general use.
    - **Targeted**: Dynamically mapped to specific `contactIds`. Selecting targeted coupons triggers an auto-resolve logic that can distribute unique codes to a filtered subset or the entire customer database.
- **Validation Pipeline**: The `Sale Order` POST handler executes a 3-step validation:
    1. **Status Check**: Verifies the coupon is `unused`.
    2. **Temporal Check**: Validates `validUntil` timestamps against server time.
    3. **Identity Check**: Ensures the `coupon.contactId` matches the `order.customerId`.

### 3. **Procurement & Inventory Synchronization**
- **Purchase-to-Bill Conversion**: Automates the generation of **Vendor Bills** from **Purchase Orders**. The system extracts metadata from POs, calculates `totalUntaxed` and `totalTaxed` values, and creates a corresponding Bill record with vendor references.
- **Product Categorization**: Products are classified by `Type` (Service vs. Storable) and `Category`, allowing for different inventory tracking logic per item.

### 4. **Enterprise Security & Multi-User Isolation**
The system employs a strict **Role-Based Access Control (RBAC)** model layered over Firebase Auth.
- **Identity Provider**: Firebase Authentication handles JWT-based session management.
- **Server-Side Guardrails**: Custom middleware (`ensureUserWithRoles`) protects API routes. 
    - **Internal Staff**: Granted unrestricted access to management dashboards (Products, Contacts, Global Reports).
    - **Portal Users**: Strictly isolated via Firestore filters. The API automatically injects `.where("customerId", "==", auth.uid)` into all queries, ensuring users only see their own Orders, Invoices, and Profile data.
- **Admin Privileges**: Sensitive operations like `Auto-Invoicing` configuration and `User Management` are restricted to users with the `internal` claim.

---

##  Cutting-Edge Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | **Next.js 15** (App Router, Server Components, Route Handlers) |
| **Database** | **Cloud Firestore** (NoSQL, Atomic Batches, Real-time Listeners) |
| **Auth** | **Firebase Auth** + **Firebase Admin SDK** (JWT Verification) |
| **UI/UX** | **Tailwind CSS 4** (Glassmorphism, CSS Variables, Custom Theme) |
| **Primitives** | **Radix UI** (Accessible components), **Lucide React** (Iconography) |
| **Concurrency** | **Axios** (Optimized API calls with interceptors) |
| **Type Safety** | **Strict TypeScript** (Shared interfaces across Frontend/Backend) |

---

##  System Directory Map

- **`app/api/`**: The heart of the business logic.
  - `sale-order/`: Orchestrates the SO -> Invoice -> Coupon exhaustion lifecycle.
  - `coupon/`: Logic for bulk generation and targeted distribution.
  - `finance-settings/`: System-wide behavior configuration (Auto-Invoicing).
- **`app/portal/`**: Client-exclusive routes with enforced data isolation.
- **`lib/`**:
  - `firebaseAdmin.ts`: Initialized with Service Account for high-privilege operations.
  - `apiAuth.ts`: Higher-order functions for role enforcement and token decoding.
  - `cart.ts`: Logic for client-side state management of products and discounts.
- **`types/`**: Exhaustive schema definitions for all 15+ business entities (Invoices, Bills, Products, etc.).

---

##  Deployment & Setup

### Environment Prerequisites
You must configure both the **Firebase Client SDK** and **Admin SDK** credentials.

```env
# Client-Side (Public)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# Server-Side (Secret)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Quick Start
1. **Install Dependencies**: `npm install`
2. **Launch Dev Environment**: `npm run dev`
3. **Build Target**: `npm run build`

---

##  Competition-Ready Features
-  **Full CRUD on 10+ Business Entities**.
-  **Atomic Database Operations**: Multi-document updates via `WriteBatch`.
-  **Secure Data Isolation**: Zero data leakage between portal users.
-  **Automated Workflows**: Real-time SO-to-Invoice conversion.
-  **Modern Architecture**: Leverages React 19's latest performance features.

---

##  License
This project is licensed under the MIT License. Developed for SVNIT Competition.