import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requireAdmin, authErrorResponse } from "@/lib/firebase/authorization";
import { trainingQuery } from "@/lib/booking/admin-query";
import { bookingResponse } from "@/lib/booking/security";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const columns = ["Booking number", "Full name", "National ID", "Mobile", "Email", "Cohort ID", "Status", "Amount (SAR)", "Created at", "Payment ID"];
function safe(value: unknown) { const text = String(value ?? ""); return /^[\s]*[=+@-]/.test(text) ? "'" + text : text; }
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request, ["owner", "admin"]);
    const { collection, query } = trainingQuery(request);
    if (collection !== "bookings") return Response.json({ error: "EXPORT_BOOKINGS_ONLY" }, { status: 400 });
    const records: unknown[][] = [];
    let cursor: QueryDocumentSnapshot | undefined;
    while (true) {
      const page = await (cursor ? query.startAfter(cursor) : query).limit(500).get();
      for (const doc of page.docs) {
        const b = doc.data(); const a = b.attendee || {};
        records.push([b.bookingNumber, a.fullName, a.nationalId, a.mobile, a.email, b.cohortId, b.status, (b.amountMinor || 0) / 100, new Date(b.createdAt).toISOString(), b.paymentId || ""]);
      }
      if (records.length > 20000) return Response.json({ error: "EXPORT_TOO_LARGE_USE_COHORT_OR_STATUS_FILTER" }, { status: 413 });
      if (page.size < 500) break;
      cursor = page.docs[page.size - 1];
    }
    const filename = "sea-registrants-" + new Date().toISOString().slice(0, 10);
    if (request.nextUrl.searchParams.get("format") === "csv") {
      const cell = (v: unknown) => '"' + safe(v).replaceAll('"', '""') + '"';
      return new Response("\uFEFF" + [columns, ...records].map((r) => r.map(cell).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="' + filename + '.csv"', "Cache-Control": "private, no-store" } });
    }
    const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet("Registrants", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
    sheet.addRow(columns); sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF087180" } };
    for (const row of records) sheet.addRow(row.map((v) => typeof v === "number" ? v : safe(v)));
    sheet.columns.forEach((column) => { column.width = 25; }); sheet.autoFilter = { from: "A1", to: "J1" };
    const data = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="' + filename + '.xlsx"', "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Error && error.name === "AdminAuthError") return authErrorResponse(error);
    return bookingResponse(error);
  }
}

