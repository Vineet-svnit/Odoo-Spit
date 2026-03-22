"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { CustomerInvoice } from "@/types/customerInvoice";
import type { CustomerPayment } from "@/types/customerPayment";
import type { PaymentBill } from "@/types/paymentBill";
import type { PurchaseOrder } from "@/types/purchaseOrder";
import type { SaleOrder } from "@/types/saleOrder";
import type { VendorBill } from "@/types/vendorBill";
import InternalNavbar from "@/components/InternalNavbar";


type SummaryCard = {
  title: string;
  line1: string;
  line2?: string;
  href?: string;
};

interface PurchaseOrdersResponse {
  success?: boolean;
  data?: PurchaseOrder[];
  error?: string;
}

interface SaleOrdersResponse {
  success?: boolean;
  data?: SaleOrder[];
  error?: string;
}

interface VendorBillsResponse {
  success?: boolean;
  data?: VendorBill[];
  error?: string;
}

interface PaymentBillsResponse {
  success?: boolean;
  data?: PaymentBill[];
  error?: string;
}

interface CustomerInvoicesResponse {
  success?: boolean;
  data?: CustomerInvoice[];
  error?: string;
}

interface CustomerPaymentsResponse {
  success?: boolean;
  data?: CustomerPayment[];
  error?: string;
}

interface AutoInvoicingResponse {
  success?: boolean;
  data?: {
    enabled: boolean;
  };
  error?: string;
}

function getTimestampMillis(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const withToMillis = value as { toMillis?: () => number };

  if (typeof withToMillis.toMillis === "function") {
    return withToMillis.toMillis();
  }

  const withSeconds = value as { _seconds?: number; seconds?: number };
  const seconds = withSeconds._seconds ?? withSeconds.seconds;

  if (typeof seconds === "number") {
    return seconds * 1000;
  }

  return null;
}

const purchaseCards: SummaryCard[] = [
  {
    title: "Purchase Orders",
    line1: "Total orders of current month",
    line2: "Purchase orders to bill",
  },
  {
    title: "Vendor Bills",
    line1: "Unpaid bills",
    line2: "Overdue",
  },
  {
    title: "Vendor Payments",
    line1: "Payment summary",
  },
];

function DashboardCard({ title, line1, line2, href }: SummaryCard) {
  const card = (
    <Card className="app-surface relative overflow-hidden p-5 transition app-surface-hover">
      <CardHeader className="p-0 mb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">Overview</CardTitle>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{title}</h2>
      </CardHeader>
      <CardContent className="p-0">
        <p className="mt-2 text-sm text-zinc-700">{line1}</p>
        {line2 ? <p className="mt-1 text-sm font-medium text-zinc-900">{line2}</p> : null}
      </CardContent>
      <div className="pointer-events-none absolute -top-14 -right-14 h-32 w-32 rounded-full bg-teal-100/70 blur-2xl" />
    </Card>
  );

  if (!href) {
    return card;
  }

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : card;
}

export default function OrdersInvoicesBillsPage() {
  const [salesOrders, setSalesOrders] = useState<SaleOrder[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [vendorPayments, setVendorPayments] = useState<PaymentBill[]>([]);
  const [autoInvoicingEnabled, setAutoInvoicingEnabled] = useState(false);
  const [isAutoInvoicingLoading, setIsAutoInvoicingLoading] = useState(true);
  const [isAutoInvoicingSaving, setIsAutoInvoicingSaving] = useState(false);

  useEffect(() => {
    async function loadPurchaseData() {
      try {
        const token = await getCurrentIdToken();

        const [
          salesOrdersResponse,
          customerInvoicesResponse,
          customerPaymentsResponse,
          purchaseOrdersResponse,
          vendorBillsResponse,
          vendorPaymentsResponse,
          autoInvoicingResponse,
        ] = await Promise.all([
          fetch("/api/sale-order", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/customer-invoice", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/customer-payment", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/purchaseorder", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/vendor-bill", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/payment-bill?partnerType=vendor", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/finance-settings/auto-invoicing", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const salesOrdersPayload = (await salesOrdersResponse.json()) as SaleOrdersResponse;
        const customerInvoicesPayload =
          (await customerInvoicesResponse.json()) as CustomerInvoicesResponse;
        const customerPaymentsPayload =
          (await customerPaymentsResponse.json()) as CustomerPaymentsResponse;
        const purchaseOrdersPayload =
          (await purchaseOrdersResponse.json()) as PurchaseOrdersResponse;
        const vendorBillsPayload = (await vendorBillsResponse.json()) as VendorBillsResponse;
        const vendorPaymentsPayload = (await vendorPaymentsResponse.json()) as PaymentBillsResponse;
        const autoInvoicingPayload = (await autoInvoicingResponse.json()) as AutoInvoicingResponse;

        if (!salesOrdersResponse.ok || !salesOrdersPayload.success) {
          setSalesOrders([]);
        } else {
          setSalesOrders(Array.isArray(salesOrdersPayload.data) ? salesOrdersPayload.data : []);
        }

        if (!customerInvoicesResponse.ok || !customerInvoicesPayload.success) {
          setCustomerInvoices([]);
        } else {
          setCustomerInvoices(
            Array.isArray(customerInvoicesPayload.data) ? customerInvoicesPayload.data : [],
          );
        }

        if (!customerPaymentsResponse.ok || !customerPaymentsPayload.success) {
          setCustomerPayments([]);
        } else {
          setCustomerPayments(
            Array.isArray(customerPaymentsPayload.data) ? customerPaymentsPayload.data : [],
          );
        }

        if (!purchaseOrdersResponse.ok || !purchaseOrdersPayload.success) {
          setPurchaseOrders([]);
        } else {
          setPurchaseOrders(
            Array.isArray(purchaseOrdersPayload.data) ? purchaseOrdersPayload.data : [],
          );
        }

        if (!vendorBillsResponse.ok || !vendorBillsPayload.success) {
          setVendorBills([]);
        } else {
          setVendorBills(Array.isArray(vendorBillsPayload.data) ? vendorBillsPayload.data : []);
        }

        if (!vendorPaymentsResponse.ok || !vendorPaymentsPayload.success) {
          setVendorPayments([]);
        } else {
          setVendorPayments(
            Array.isArray(vendorPaymentsPayload.data) ? vendorPaymentsPayload.data : [],
          );
        }

        if (!autoInvoicingResponse.ok || !autoInvoicingPayload.success || !autoInvoicingPayload.data) {
          setAutoInvoicingEnabled(false);
        } else {
          setAutoInvoicingEnabled(Boolean(autoInvoicingPayload.data.enabled));
        }
      } catch {
        setSalesOrders([]);
        setCustomerInvoices([]);
        setCustomerPayments([]);
        setPurchaseOrders([]);
        setVendorBills([]);
        setVendorPayments([]);
        setAutoInvoicingEnabled(false);
      } finally {
        setIsAutoInvoicingLoading(false);
      }
    }

    void loadPurchaseData();
  }, []);

  async function handleToggleAutoInvoicing() {
    try {
      setIsAutoInvoicingSaving(true);

      const token = await getCurrentIdToken();
      const nextState = !autoInvoicingEnabled;

      const response = await fetch("/api/finance-settings/auto-invoicing", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: nextState }),
      });

      const payload = (await response.json()) as AutoInvoicingResponse;

      if (!response.ok || !payload.success || !payload.data) {
        return;
      }

      setAutoInvoicingEnabled(Boolean(payload.data.enabled));
    } finally {
      setIsAutoInvoicingSaving(false);
    }
  }

  const salesOrdersCurrentMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return salesOrders.filter((salesOrder) => {
      const millis = getTimestampMillis(salesOrder.soDate);

      if (millis === null) {
        return false;
      }

      const date = new Date(millis);

      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  }, [salesOrders]);

  const unpaidCustomerInvoices = useMemo(
    () => customerInvoices.filter((customerInvoice) => customerInvoice.amountDue > 0).length,
    [customerInvoices],
  );

  const overdueCustomerInvoices = useMemo(() => {
    const now = Date.now();

    return customerInvoices.filter((customerInvoice) => {
      if (customerInvoice.amountDue <= 0) {
        return false;
      }

      const dueMillis = getTimestampMillis(customerInvoice.invoiceDue);

      if (dueMillis === null) {
        return false;
      }

      return now > dueMillis;
    }).length;
  }, [customerInvoices]);

  const purchaseOrdersCurrentMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return purchaseOrders.filter((purchaseOrder) => {
      const millis = getTimestampMillis(purchaseOrder.poDate);

      if (millis === null) {
        return false;
      }

      const date = new Date(millis);

      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  }, [purchaseOrders]);

  const unpaidVendorBills = useMemo(
    () => vendorBills.filter((vendorBill) => vendorBill.amountDue > 0).length,
    [vendorBills],
  );

  const overdueVendorBills = useMemo(() => {
    const now = Date.now();

    return vendorBills.filter((vendorBill) => {
      if (vendorBill.amountDue <= 0) {
        return false;
      }

      const dueMillis = getTimestampMillis(vendorBill.billDue);

      if (dueMillis === null) {
        return false;
      }

      return now > dueMillis;
    }).length;
  }, [vendorBills]);

  const purchaseCards: SummaryCard[] = [
    {
      title: "Purchase Orders",
      line1: `Total orders of current month: ${purchaseOrdersCurrentMonth}`,
      line2: `Purchase orders to bill: ${unpaidVendorBills}`,
      href: "/purchase-order",
    },
    {
      title: "Vendor Bills",
      line1: `Unpaid bills: ${unpaidVendorBills}`,
      line2: `Overdue: ${overdueVendorBills}`,
      href: "/vendor-bill",
    },
    {
      title: "Vendor Payments",
      line1: `Transactions: ${vendorPayments.length}`,
      line2: "Click to view",
      href: "/vendor-payment",
    },
  ];

  const salesCards: SummaryCard[] = [
    {
      title: "Sales Orders",
      line1: `Total orders of current month: ${salesOrdersCurrentMonth}`,
      line2: `Sales orders to invoice: ${unpaidCustomerInvoices}`,
      href: "/sales-order",
    },
    {
      title: "Customer Invoices",
      line1: `Unpaid invoices: ${unpaidCustomerInvoices}`,
      line2: `Overdue: ${overdueCustomerInvoices}`,
      href: "/customer-invoice",
    },
    {
      title: "Customer Payments",
      line1: `Transactions: ${customerPayments.length}`,
      line2: "Click to view",
      href: "/customer-payment",
    },
  ];

  return (
    <>
    <InternalNavbar/>
    <main className="app-shell px-6 py-10">
      <Card className="app-surface mx-auto w-full max-w-6xl p-6 md:p-8">
        <CardHeader className="mb-8 flex flex-wrap items-start justify-between gap-4 p-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Finance</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
              Orders, Invoices, and Bills
            </h1>
            <p className="mt-2 text-sm text-zinc-600">Overview page for sales and purchase operations.</p>
          </div>
          <Card className="app-surface rounded-xl px-4 py-3 shadow-sm border border-zinc-200">
            <CardHeader className="p-0 mb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">Automatic Invoicing</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-2 flex items-center gap-3">
              <Button
                type="button"
                onClick={handleToggleAutoInvoicing}
                disabled={isAutoInvoicingLoading || isAutoInvoicingSaving}
                variant={autoInvoicingEnabled ? "default" : "secondary"}
                className="h-9 px-3 text-sm font-semibold"
              >
                {isAutoInvoicingSaving
                  ? "Saving..."
                  : autoInvoicingEnabled
                    ? "Enabled"
                    : "Disabled"}
              </Button>
              <p className="text-xs text-zinc-600">
                {autoInvoicingEnabled
                  ? "Invoices are auto-created after sale order creation."
                  : "Manual invoice creation flow is active."}
              </p>
            </CardContent>
          </Card>
        </CardHeader>

        <section>
          <h3 className="mb-4 text-lg font-semibold text-zinc-900">Sales</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {salesCards.map((card) => (
              <DashboardCard key={card.title} {...card} />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-zinc-900">Purchase</h3>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {purchaseCards.map((card) => (
              <DashboardCard key={card.title} {...card} />
            ))}
          </div>
        </section>
      </Card>
    </main>
    </>
  );
}
