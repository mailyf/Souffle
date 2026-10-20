import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const filter = user.role === "customer" ? "WHERE o.customer_id = ?" : "";
  const payments = getDb().prepare(`SELECT p.*, r.receipt_number AS receiptNumber, r.issued_at AS issuedAt FROM payments p JOIN orders o ON o.id = p.order_id LEFT JOIN receipts r ON r.payment_id = p.id ${filter} ORDER BY p.payment_date DESC`).all(...(user.role === "customer" ? [user.customerId] : []));
  return NextResponse.json({ payments });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await request.json().catch(() => null) as { orderId?: string; method?: string; cashReceived?: number } | null;
  if (!body?.orderId || !["Card", "Cash"].includes(body.method ?? "")) {
    return NextResponse.json({ error: "Select an order and a supported payment method." }, { status: 400 });
  }

  const db = getDb();
  const order = db.prepare("SELECT id, customer_id AS customerId, total, status FROM orders WHERE id = ?").get(body.orderId) as { id: string; customerId: string | null; total: number; status: string } | undefined;
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (user.role === "customer" && order.customerId !== user.customerId) return NextResponse.json({ error: "You can only pay for your own order." }, { status: 403 });
  if (order.status === "Cancelled") return NextResponse.json({ error: "Cancelled orders cannot be paid." }, { status: 400 });
  if (db.prepare("SELECT 1 FROM payments WHERE order_id = ? AND status = 'Paid'").get(order.id)) return NextResponse.json({ error: "This order has already been paid." }, { status: 409 });
  const cashReceived = body.method === "Cash" ? Number(body.cashReceived) : null;
  if (body.method === "Cash" && (!Number.isInteger(cashReceived) || cashReceived! < order.total)) {
    return NextResponse.json({ error: "Cash received must cover the order total." }, { status: 400 });
  }

  const paymentId = `PAY-${randomBytes(4).toString("hex").toUpperCase()}`;
  const receiptNumber = `RCPT-${randomBytes(4).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();
  const changeDue = body.method === "Cash" ? cashReceived! - order.total : null;
  const authorizationCode = body.method === "Card" ? `AUTH${randomBytes(3).toString("hex").toUpperCase()}` : null;
  const pay = db.transaction(() => {
    db.prepare("INSERT INTO payments (id, order_id, amount, method, payment_date, status, card_type, authorization_code, cash_received, change_due) VALUES (?, ?, ?, ?, ?, 'Paid', ?, ?, ?, ?)")
      .run(paymentId, order.id, order.total, body.method, now, body.method === "Card" ? "Visa" : null, authorizationCode, cashReceived, changeDue);
    db.prepare("INSERT INTO receipts (id, payment_id, receipt_number, issued_at, total_paid) VALUES (?, ?, ?, ?, ?)")
      .run(`REC-${randomBytes(4).toString("hex").toUpperCase()}`, paymentId, receiptNumber, now, order.total);
    if (order.customerId) {
      const points = Math.floor(order.total / 100);
      db.prepare("UPDATE customers SET points = points + ? WHERE id = ?").run(points, order.customerId);
      db.prepare("INSERT INTO loyalty_events (customer_id, order_id, points_issued, created_at) VALUES (?, ?, ?, ?)").run(order.customerId, order.id, points, now);
    }
  });
  pay();
  return NextResponse.json({ payment: { id: paymentId, amount: order.total, method: body.method, status: "Paid", authorizationCode, changeDue }, receipt: { receiptNumber, issuedAt: now, totalPaid: order.total } }, { status: 201 });
}