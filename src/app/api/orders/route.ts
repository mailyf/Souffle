import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const filter = user.role === "customer" ? "WHERE o.customer_id = ?" : "";
  const orders = getDb().prepare(`SELECT o.*, c.first_name || ' ' || c.last_name AS customer_name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id ${filter} ORDER BY order_date DESC`).all(...(user.role === "customer" ? [user.customerId] : []));
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    items?: Array<{ menuItemId: string; quantity: number; instructions?: string }>;
    orderType?: string;
    channel?: string;
    customerEmail?: string;
    customerName?: string;
    promotionId?: string;
  } | null;
  if (!body?.items?.length || body.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
    return NextResponse.json({ error: "Add at least one item with a quantity between 1 and 20." }, { status: 400 });
  }

  const db = getDb();
  const products = body.items.map((line) => {
    const item = db.prepare("SELECT id, name, price FROM menu_items WHERE id = ? AND available = 1").get(line.menuItemId) as { id: string; name: string; price: number } | undefined;
    if (!item) throw new Error("One of those menu items is unavailable.");
    return { ...line, item, total: item.price * line.quantity };
  });
  const subtotal = products.reduce((sum, line) => sum + line.total, 0);
  let promotionId: string | null = null;
  let discount = 0;
  if (body.promotionId) {
    const promo = db.prepare("SELECT * FROM promotions WHERE id = ? AND status = 'Shared' AND date('now') BETWEEN date(start_date) AND date(end_date)").get(body.promotionId) as { id: string; discount_type: string; discount_value: number } | undefined;
    if (promo) {
      promotionId = promo.id;
      discount = promo.discount_type === "percent" ? Math.round(subtotal * promo.discount_value / 100) : Math.min(subtotal, promo.discount_value);
    }
  }
  let customerId = user.role === "customer" ? user.customerId : null;
  if (!customerId && body.customerEmail) {
    const email = body.customerEmail.trim().toLowerCase();
    const existing = db.prepare("SELECT id FROM customers WHERE lower(email) = ?").get(email) as { id: string } | undefined;
    customerId = existing?.id ?? `CUS-${Date.now()}`;
    if (!existing) {
      const [firstName = "Guest", ...lastName] = (body.customerName ?? "Guest Customer").trim().split(/\s+/);
      db.prepare("INSERT INTO customers (id, first_name, last_name, email, phone, points, created_at) VALUES (?, ?, ?, ?, '', 0, ?)").run(customerId, firstName, lastName.join(" ") || "Customer", email, new Date().toISOString());
    }
  }
  const latest = db.prepare("SELECT MAX(CAST(substr(id, 5) AS INTEGER)) AS value FROM orders").get() as { value: number | null };
  const number = (latest.value ?? 1048) + 1;
  const id = `ORD-${number}`;
  const confirmationNumber = `SF${randomInt(1000, 9999)}${String.fromCharCode(randomInt(65, 91))}`;
  const now = new Date();
  const ready = new Date(now.getTime() + 90 * 60 * 1000);
  const create = db.transaction(() => {
    db.prepare(`INSERT INTO orders (id, customer_id, employee_id, order_date, order_type, channel, status, subtotal, discount, total, estimated_ready_time, confirmation_number, promotion_id)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, ?)`)
      .run(id, customerId, user.employeeId, now.toISOString(), body.orderType ?? "Pickup", body.channel ?? (user.role === "customer" ? "Online" : "In store"), subtotal, discount, subtotal - discount, ready.toISOString(), confirmationNumber, promotionId);
    const insertLine = db.prepare("INSERT INTO order_lines (order_id, menu_item_id, item_name, quantity, special_instructions, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)");
    products.forEach((line) => insertLine.run(id, line.item.id, line.item.name, line.quantity, line.instructions ?? "", line.item.price, line.total));
  });
  try {
    create();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create this order." }, { status: 400 });
  }
  return NextResponse.json({ order: { id, confirmationNumber, total: subtotal - discount, status: "Pending", estimatedReadyTime: ready.toISOString() } }, { status: 201 });
}