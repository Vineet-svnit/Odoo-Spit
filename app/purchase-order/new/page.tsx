"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Contact } from "@/types/contact";
import type { Product } from "@/types/product";
import type { PurchaseOrder, PurchaseOrderLineItem } from "@/types/purchaseOrder";

interface PurchaseOrdersResponse {
  success?: boolean;
  data?: PurchaseOrder[];
  error?: string;
}

interface ProductResponse {
  success?: boolean;
  data?: Product[];
  error?: string;
}

interface ContactsResponse {
  success?: boolean;
  data?: Contact[];
  error?: string;
}

interface CreatePurchaseOrderResponse {
  success?: boolean;
  data?: {
    purchaseOrderId: string;
    vendorBillId: string;
  };
  error?: string;
}

type PurchaseOrderState = "draft" | "confirmed";

interface DraftLine {
  id: string;
  productId: string;
  qty: string;
}

function formatPoNumber(sequence: number): string {
  return `P${sequence.toString().padStart(4, "0")}`;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTodayDateInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createEmptyLine(): DraftLine {
  return {
    id: crypto.randomUUID(),
    productId: "",
    qty: "1",
  };
}

function computeLine(
  line: DraftLine,
  productsById: Record<string, Product>,
): (PurchaseOrderLineItem & { untaxedAmount: number }) | null {
  const selectedProduct = productsById[line.productId];
  const qty = toNumber(line.qty);

  if (!selectedProduct || !Number.isInteger(qty) || qty <= 0) {
    return null;
  }

  const unitPrice = selectedProduct.purchasePrice;
  const tax = selectedProduct.purchaseTax;
  const untaxedAmount = qty * unitPrice;
  const taxAmount = (untaxedAmount * tax) / 100;
  const total = untaxedAmount + taxAmount;

  return {
    product: selectedProduct.productId,
    qty,
    unitPrice,
    tax,
    taxAmount,
    total,
    untaxedAmount,
  };
}

export default function NewPurchaseOrderPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [poNumber, setPoNumber] = useState("P0001");
  const [poDate] = useState(getTodayDateInputValue());
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([createEmptyLine()]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [purchaseOrderState, setPurchaseOrderState] = useState<PurchaseOrderState>("draft");

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      setIsError(false);
      setMessage(null);

      try {
        const token = await getCurrentIdToken();

        const [productsResponse, contactsResponse, purchaseOrdersResponse] = await Promise.all([
          fetch("/api/product", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/contacts", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/purchaseorder", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const productsPayload = (await productsResponse.json()) as ProductResponse;
        const contactsPayload = (await contactsResponse.json()) as ContactsResponse;
        const purchaseOrdersPayload = (await purchaseOrdersResponse.json()) as PurchaseOrdersResponse;

        if (!productsResponse.ok || !productsPayload.success) {
          setIsError(true);
          setMessage(productsPayload.error ?? "Failed to fetch products");
          return;
        }

        if (!contactsResponse.ok || !contactsPayload.success) {
          setIsError(true);
          setMessage(contactsPayload.error ?? "Failed to fetch contacts");
          return;
        }

        if (!purchaseOrdersResponse.ok || !purchaseOrdersPayload.success) {
          setIsError(true);
          setMessage(purchaseOrdersPayload.error ?? "Failed to fetch purchase orders");
          return;
        }

        const allProducts = Array.isArray(productsPayload.data) ? productsPayload.data : [];
        const allContacts = Array.isArray(contactsPayload.data) ? contactsPayload.data : [];
        const allPurchaseOrders = Array.isArray(purchaseOrdersPayload.data)
          ? purchaseOrdersPayload.data
          : [];

        const vendorRows = allContacts.filter(
          (contact) => contact.type === "vendor" || contact.type === "both",
        );

        setProducts(allProducts);
        setVendors(vendorRows);
        setPoNumber(formatPoNumber(allPurchaseOrders.length + 1));
      } catch (fetchError) {
        const fallback =
          fetchError instanceof Error ? fetchError.message : "Failed to load form data";
        setIsError(true);
        setMessage(fallback);
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialData();
  }, []);

  const productsById = useMemo(
    () =>
      products.reduce<Record<string, Product>>((accumulator, product) => {
        accumulator[product.productId] = product;
        return accumulator;
      }, {}),
    [products],
  );

  const computedLines = useMemo(
    () => lines.map((line) => computeLine(line, productsById)),
    [lines, productsById],
  );

  const totalUntaxed = useMemo(
    () => computedLines.reduce((sum, line) => sum + (line?.untaxedAmount ?? 0), 0),
    [computedLines],
  );

  const totalTaxed = useMemo(
    () => computedLines.reduce((sum, line) => sum + (line?.total ?? 0), 0),
    [computedLines],
  );

  function updateLine(lineId: string, update: Partial<DraftLine>) {
    setLines((previous) =>
      previous.map((line) => (line.id === lineId ? { ...line, ...update } : line)),
    );
  }

  function handleAddLine() {
    setLines((previous) => [...previous, createEmptyLine()]);
  }

  function handleRemoveLine(lineId: string) {
    setLines((previous) => {
      if (previous.length === 1) {
        return previous;
      }

      return previous.filter((line) => line.id !== lineId);
    });
  }

  function handleConfirm() {
    setIsError(false);
    setMessage(null);

    if (!selectedVendorId) {
      setIsError(true);
      setMessage("Please select a vendor before confirming");
      return;
    }

    const validLines = computedLines.filter(
      (line): line is PurchaseOrderLineItem & { untaxedAmount: number } => line !== null,
    );

    if (validLines.length !== lines.length || validLines.length === 0) {
      setIsError(true);
      setMessage("Please add valid product rows with positive quantity before confirming");
      return;
    }

    setPurchaseOrderState("confirmed");
    setMessage("Purchase order confirmed. You can now create the bill.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      if (!selectedVendorId) {
        setIsError(true);
        setMessage("Please select a vendor");
        return;
      }

      const validLines = computedLines.filter(
        (line): line is PurchaseOrderLineItem & { untaxedAmount: number } => line !== null,
      );

      if (validLines.length !== lines.length || validLines.length === 0) {
        setIsError(true);
        setMessage("Please add valid product rows with positive quantity");
        return;
      }

      const payload = {
        vendorId: selectedVendorId,
        poNumber,
        order: validLines.map(({ untaxedAmount, ...line }) => line),
        totalUntaxed,
        totalTaxed,
      };

      const token = await getCurrentIdToken();

      const response = await fetch("/api/purchaseorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as CreatePurchaseOrderResponse;

      if (!response.ok || !result.success || !result.data?.purchaseOrderId) {
        setIsError(true);
        setMessage(result.error ?? "Failed to create bill");
        return;
      }

      router.push(`/purchase-order/${result.data.purchaseOrderId}`);
    } catch {
      setIsError(true);
      setMessage("Failed to create purchase order");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_12%,#ffe2bc_0%,transparent_35%),radial-gradient(circle_at_87%_14%,#c9eee1_0%,transparent_35%),linear-gradient(145deg,#f8f3e8,#edf8f2)] px-6 py-10">
      <section className="mx-auto w-full max-w-7xl rounded-3xl border border-black/10 bg-white/90 p-6 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.4)] backdrop-blur md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Purchase</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">New Purchase Order</h1>
            <p className="mt-2 text-sm text-zinc-600">Build rows and totals are calculated automatically.</p>
          </div>

          <Link
            href="/purchase-order"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Back to Purchase Orders
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">State</span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
                purchaseOrderState === "draft"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {purchaseOrderState}
            </span>
          </div>

          {purchaseOrderState === "draft" ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex h-10 items-center rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Confirm
            </button>
          ) : null}
        </div>

        {isLoading ? (
          <p className="text-sm text-zinc-600">Loading products, vendors, and sequence...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">Vendor Name</span>
                <select
                  value={selectedVendorId}
                  onChange={(event) => setSelectedVendorId(event.target.value)}
                  className="h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-emerald-600"
                  required
                >
                  <option value="">Select vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.contactId} value={vendor.contactId}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">PO Number</span>
                <input
                  value={poNumber}
                  readOnly
                  className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">PO Date</span>
                <input
                  value={poDate}
                  readOnly
                  className="h-10 rounded-lg border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-700"
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs uppercase tracking-[0.14em] text-zinc-600">
                  <tr>
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3 text-right">Qty</th>
                    <th className="px-3 py-3 text-right">Unit Price</th>
                    <th className="px-3 py-3 text-right">Untaxed Amount</th>
                    <th className="px-3 py-3 text-right">Tax (%)</th>
                    <th className="px-3 py-3 text-right">Tax Amount</th>
                    <th className="px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {lines.map((line, index) => {
                    const selectedProduct = productsById[line.productId];
                    const qty = toNumber(line.qty);
                    const unitPrice = selectedProduct?.purchasePrice ?? 0;
                    const tax = selectedProduct?.purchaseTax ?? 0;
                    const untaxedAmount = Number.isInteger(qty) && qty > 0 ? qty * unitPrice : 0;
                    const taxAmount = (untaxedAmount * tax) / 100;
                    const total = untaxedAmount + taxAmount;

                    return (
                      <tr key={line.id}>
                        <td className="px-3 py-3">
                          <select
                            value={line.productId}
                            onChange={(event) =>
                              updateLine(line.id, { productId: event.target.value })
                            }
                            className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-sm outline-none transition focus:border-emerald-600"
                            required
                          >
                            <option value="">Select product</option>
                            {products.map((product) => (
                              <option key={product.productId} value={product.productId}>
                                {product.productName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <input
                            value={line.qty}
                            onChange={(event) =>
                              updateLine(line.id, {
                                qty: event.target.value.replace(/[^0-9]/g, ""),
                              })
                            }
                            inputMode="numeric"
                            className="h-9 w-20 rounded-lg border border-zinc-300 bg-white px-2 text-right text-sm outline-none transition focus:border-emerald-600"
                            required
                          />
                        </td>
                        <td className="px-3 py-3 text-right text-zinc-800">₹{unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-zinc-800">₹{untaxedAmount.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-zinc-800">{tax.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right text-zinc-800">₹{taxAmount.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-medium text-zinc-900">₹{total.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            disabled={lines.length === 1}
                            className="h-8 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-zinc-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-3">
                      <button
                        type="button"
                        onClick={handleAddLine}
                        className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100"
                      >
                        + Add Row
                      </button>
                    </td>
                    <td colSpan={2} className="px-3 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600">
                      Total Untaxed
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-zinc-900">₹{totalUntaxed.toFixed(2)}</td>
                    <td className="px-3 py-3" />
                  </tr>
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-right text-xs uppercase tracking-[0.12em] text-zinc-600">
                      Total Taxed
                    </td>
                    <td className="px-3 py-3 text-right text-lg font-bold text-zinc-900">₹{totalTaxed.toFixed(2)}</td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {message ? (
              <p className={`rounded-xl px-4 py-3 text-sm ${isError ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                {message}
              </p>
            ) : null}

            {purchaseOrderState === "confirmed" ? (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create Bill"}
                </button>
              </div>
            ) : null}
          </form>
        )}
      </section>
    </main>
  );
}
