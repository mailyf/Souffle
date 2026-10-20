import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const items = getDb().prepare("SELECT id, name, unit, quantity, minimum_quantity AS minimumQuantity, updated_at AS updatedAt FROM inventory_items ORDER BY name").all();
  return NextResponse.json({ items });
}

export async function PATCH(request: Request) {
  const user = await getSession();
  if (!user || user.role === "customer") return NextResponse.json({ error: "Employee access is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { id?: string; quantity?: number; minimumQuantity?: number } | null;
  if (!body?.id || !Number.isFinite(body.quantity) || body.quantity! < 0 || (body.minimumQuantity !== undefined && (!Number.isFinite(body.minimumQuantity) || body.minimumQuantity < 0))) {
    return NextResponse.json({ error: "Enter a valid stock quantity." }, { status: 400 });
  }
  const db = getDb();
  const item = db.prepare("SELECT id FROM inventory_items WHERE id = ?").get(body.id);
  if (!item) return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
  if (body.minimumQuantity !== undefined && user.role === "manager") {
    db.prepare("UPDATE inventory_items SET quantity = ?, minimum_quantity = ?, updated_at = ? WHERE id = ?").run(body.quantity, body.minimumQuantity, new Date().toISOString(), body.id);
  } else {
    db.prepare("UPDATE inventory_items SET quantity = ?, updated_at = ? WHERE id = ?").run(body.quantity, new Date().toISOString(), body.id);
  }
  return NextResponse.json({ ok: true });
}