import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { status?: string } | null;
  const allowed = ["Pending", "In Kitchen", "Ready", "Completed", "Cancelled"];
  if (!body?.status || !allowed.includes(body.status)) return NextResponse.json({ error: "Choose a valid order status." }, { status: 400 });
  const db = getDb();
  const order = db.prepare("SELECT id, status, customer_id AS customerId FROM orders WHERE id = ?").get(id) as { id: string; status: string; customerId: string | null } | undefined;
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (user.role === "customer") {
    if (body.status !== "Cancelled" || order.customerId !== user.customerId || !["Pending", "In Kitchen"].includes(order.status)) {
      return NextResponse.json({ error: "Customers may only request cancellation for their own order before it is ready." }, { status: 403 });
    }
    db.prepare("UPDATE orders SET status = 'Cancellation Requested' WHERE id = ?").run(id);
    return NextResponse.json({ ok: true, status: "Cancellation Requested" });
  }
  if (body.status === "Cancelled" && user.role !== "manager") {
    return NextResponse.json({ error: "A manager must approve cancellations." }, { status: 403 });
  }
  if (body.status === "Cancelled" && order.status !== "Cancellation Requested") {
    return NextResponse.json({ error: "Only a requested cancellation can be approved." }, { status: 409 });
  }
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(body.status, id);
  return NextResponse.json({ ok: true });
}