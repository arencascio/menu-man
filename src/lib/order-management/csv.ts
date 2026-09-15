import type { ManagedOrderExportRow } from "./contracts";

export const orderHistoryCsvHeaders = [
  "Order Number",
  "Placed Timestamp",
  "Pickup Timestamp",
  "Customer Name",
  "Fulfillment Status",
  "Payment Status",
  "Refund Status",
  "Item Count",
  "Subtotal",
  "Tax",
  "Tip",
  "Total",
  "Refunded Amount",
  "Completed Timestamp",
] as const;

export function escapeCsvValue(value: string | number | null) {
  let text = value === null ? "" : String(value);
  // Avoid spreadsheet formula execution while preserving the visible value.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvLine(values: readonly (string | number | null)[]) {
  return `${values.map(escapeCsvValue).join(",")}\r\n`;
}

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

export function orderHistoryCsvRow(row: ManagedOrderExportRow) {
  return csvLine([
    row.orderNumber,
    row.placedAt,
    row.pickupAt,
    row.customerName,
    row.fulfillmentStatus,
    row.paymentStatus,
    row.refundStatus,
    row.itemCount,
    money(row.subtotalCents),
    money(row.taxCents),
    money(row.tipCents),
    money(row.totalCents),
    money(row.refundAmountCents),
    row.completedAt,
  ]);
}
