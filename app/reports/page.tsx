"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import InternalNavbar from "@/components/InternalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import type { Contact } from "@/types/contact";
import type { SaleOrder } from "@/types/saleOrder";
import type { PurchaseOrder } from "@/types/purchaseOrder";
import type { Product } from "@/types/product";
import { Timestamp } from "firebase/firestore";

type ReportType = "sales" | "purchase";
type GroupBy = "products" | "contacts";

interface ReportFilters {
  reportType: ReportType;
  groupBy: GroupBy;
  fromDate: string;
  toDate: string;
}

interface SalesProductReport {
  type: "salesProduct";
  productName: string;
  soldQuantity: number;
  totalReceivedAmount: number;
}

interface PurchaseProductReport {
  type: "purchaseProduct";
  productName: string;
  purchasedQuantity: number;
  totalPaidAmount: number;
}

interface SalesContactReport {
  type: "salesContact";
  customerName: string;
  totalOrders: number;
  totalAmount: number;
}

interface PurchaseContactReport {
  type: "purchaseContact";
  vendorName: string;
  totalOrders: number;
  totalAmount: number;
}

type ReportData = SalesProductReport | PurchaseProductReport | SalesContactReport | PurchaseContactReport;

function timestampToDate(ts: Timestamp | { seconds: number; nanoseconds: number }): Date {
  if (ts instanceof Timestamp) {
    return ts.toDate();
  }
  return new Date(ts.seconds * 1000);
}

function isDateInRange(date: Date, fromDate: string, toDate: string): boolean {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  to.setHours(23, 59, 59, 999);
  return date >= from && date <= to;
}

async function generateSalesProductReport(
  orders: SaleOrder[],
  fromDate: string,
  toDate: string,
  products: Map<string, string>,
): Promise<SalesProductReport[]> {
  const reportMap = new Map<string, SalesProductReport>();

  for (const order of orders) {
    const orderDate = timestampToDate(order.soDate);
    if (!isDateInRange(orderDate, fromDate, toDate)) continue;

    for (const item of order.order) {
      const productName = products.get(item.product) || item.product;

      if (!reportMap.has(productName)) {
        reportMap.set(productName, {
          type: "salesProduct",
          productName,
          soldQuantity: 0,
          totalReceivedAmount: 0,
        });
      }

      const report = reportMap.get(productName)!;
      report.soldQuantity += item.qty;
      report.totalReceivedAmount += item.total;
    }
  }

  return Array.from(reportMap.values());
}

async function generatePurchaseProductReport(
  orders: PurchaseOrder[],
  fromDate: string,
  toDate: string,
  products: Map<string, string>,
): Promise<PurchaseProductReport[]> {
  const reportMap = new Map<string, PurchaseProductReport>();

  for (const order of orders) {
    const orderDate = timestampToDate(order.poDate);
    if (!isDateInRange(orderDate, fromDate, toDate)) continue;

    for (const item of order.order) {
      const productName = products.get(item.product) || item.product;

      if (!reportMap.has(productName)) {
        reportMap.set(productName, {
          type: "purchaseProduct",
          productName,
          purchasedQuantity: 0,
          totalPaidAmount: 0,
        });
      }

      const report = reportMap.get(productName)!;
      report.purchasedQuantity += item.qty;
      report.totalPaidAmount += item.total;
    }
  }

  return Array.from(reportMap.values());
}

async function generateSalesContactReport(
  orders: SaleOrder[],
  fromDate: string,
  toDate: string,
  contacts: Map<string, string>,
): Promise<SalesContactReport[]> {
  const reportMap = new Map<string, SalesContactReport>();

  for (const order of orders) {
    const orderDate = timestampToDate(order.soDate);
    if (!isDateInRange(orderDate, fromDate, toDate)) continue;

    const customerName = contacts.get(order.customerId) || order.customerId;

    if (!reportMap.has(customerName)) {
      reportMap.set(customerName, {
        type: "salesContact",
        customerName,
        totalOrders: 0,
        totalAmount: 0,
      });
    }

    const report = reportMap.get(customerName)!;
    report.totalOrders += 1;
    report.totalAmount += order.totalTaxed;
  }

  return Array.from(reportMap.values());
}

async function generatePurchaseContactReport(
  orders: PurchaseOrder[],
  fromDate: string,
  toDate: string,
  contacts: Map<string, string>,
): Promise<PurchaseContactReport[]> {
  const reportMap = new Map<string, PurchaseContactReport>();

  for (const order of orders) {
    const orderDate = timestampToDate(order.poDate);
    if (!isDateInRange(orderDate, fromDate, toDate)) continue;

    const vendorName = contacts.get(order.vendorId) || order.vendorId;

    if (!reportMap.has(vendorName)) {
      reportMap.set(vendorName, {
        type: "purchaseContact",
        vendorName,
        totalOrders: 0,
        totalAmount: 0,
      });
    }

    const report = reportMap.get(vendorName)!;
    report.totalOrders += 1;
    report.totalAmount += order.totalTaxed;
  }

  return Array.from(reportMap.values());
}

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({
    reportType: "sales",
    groupBy: "products",
    fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
  });

  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getCurrentIdToken();

        // Fetch all required data in parallel
        const [
          salesResponse,
          purchaseResponse,
          contactsResponse,
          productsResponse,
        ] = await Promise.all([
          fetch("/api/sale-order", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/purchaseorder", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/contacts", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/product", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const salesOrders = (await salesResponse.json()).data as SaleOrder[] || [];
        const purchaseOrders = (await purchaseResponse.json()).data as PurchaseOrder[] || [];
        const contacts = (await contactsResponse.json()).data as Contact[] || [];
        const products = (await productsResponse.json()).data as Product[] || [];

        const contactMap = new Map(contacts.map((c) => [c.contactId, c.name]));
        const productMap = new Map(products.map((p) => [p.productId, p.productName]));

        let data: ReportData[] = [];

        if (filters.reportType === "sales" && filters.groupBy === "products") {
          data = await generateSalesProductReport(salesOrders, filters.fromDate, filters.toDate, productMap);
        } else if (filters.reportType === "purchase" && filters.groupBy === "products") {
          data = await generatePurchaseProductReport(purchaseOrders, filters.fromDate, filters.toDate, productMap);
        } else if (filters.reportType === "sales" && filters.groupBy === "contacts") {
          data = await generateSalesContactReport(salesOrders, filters.fromDate, filters.toDate, contactMap);
        } else if (filters.reportType === "purchase" && filters.groupBy === "contacts") {
          data = await generatePurchaseContactReport(purchaseOrders, filters.fromDate, filters.toDate, contactMap);
        }

        setReportData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate report");
      } finally {
        setIsLoading(false);
      }
    }

    loadReport();
  }, [filters]);

  const renderTable = () => {
    if (reportData.length === 0) {
      return <p className="text-sm text-zinc-600">No data available for the selected filters.</p>;
    }

    if (filters.reportType === "sales" && filters.groupBy === "products") {
      const data = reportData as SalesProductReport[];
      return (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-zinc-900">Product Name</th>
                <th className="px-4 py-2 text-right font-semibold text-zinc-900">Sold Quantity</th>
                <th className="px-4 py-2 text-right font-semibold text-zinc-900">Total Received Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-4 py-2 text-zinc-900">{row.productName}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">{row.soldQuantity}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">₹{row.totalReceivedAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (filters.reportType === "purchase" && filters.groupBy === "products") {
      const data = reportData as PurchaseProductReport[];
      return (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-zinc-900">Product Name</th>
                <th className="px-4 py-2 text-right font-semibold text-zinc-900">Purchased Quantity</th>
                <th className="px-4 py-2 text-right font-semibold text-zinc-900">Total Paid Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-4 py-2 text-zinc-900">{row.productName}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">{row.purchasedQuantity}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">₹{row.totalPaidAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (filters.reportType === "sales" && filters.groupBy === "contacts") {
      const data = reportData as SalesContactReport[];
      return (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-zinc-900">Customer Name</th>
                <th className="px-4 py-2 text-right font-semibold text-zinc-900">Total Orders</th>
                <th className="px-4 py-2 text-right font-semibold text-zinc-900">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-4 py-2 text-zinc-900">{row.customerName}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">{row.totalOrders}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">₹{row.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (filters.reportType === "purchase" && filters.groupBy === "contacts") {
      const data = reportData as PurchaseContactReport[];
      return (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-zinc-900">Vendor Name</th>
                <th className="px-4 py-2 text-right font-semibold text-zinc-900">Total Orders</th>
                <th className="px-4 py-2 text-right font-semibold text-zinc-900">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-4 py-2 text-zinc-900">{row.vendorName}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">{row.totalOrders}</td>
                  <td className="px-4 py-2 text-right text-zinc-900">₹{row.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <section className="mx-auto w-full max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-zinc-900">Reports</h1>
            <p className="mt-2 text-zinc-600">Generate sales and purchase reports</p>
          </div>

          {/* Filters */}
          <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Filters</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Report Type</label>
                <select
                  value={filters.reportType}
                  onChange={(e) =>
                    setFilters({ ...filters, reportType: e.target.value as ReportType })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="sales">Sales</option>
                  <option value="purchase">Purchase</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Group By</label>
                <select
                  value={filters.groupBy}
                  onChange={(e) =>
                    setFilters({ ...filters, groupBy: e.target.value as GroupBy })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="products">Products</option>
                  <option value="contacts">Contacts</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) =>
                    setFilters({ ...filters, fromDate: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) =>
                    setFilters({ ...filters, toDate: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Results</h2>

            {isLoading && <p className="text-sm text-zinc-600">Loading report...</p>}
            {error && <p className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700">{error}</p>}
            {!isLoading && !error && renderTable()}
          </div>
        </section>
      </main>
    </>
  );
}
