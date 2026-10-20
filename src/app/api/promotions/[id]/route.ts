import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "manager") return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { action?: string; title?: string; discountType?: string; discountValue?: number; startDate?: string; endDate?: string; sharingChannel?: string } | null;
  const db = getDb();
  const existing = db.prepare("SELECT id FROM promotions WHERE id = ?").get(id);
  if (!existing) return NextResponse.json({ error: "Promotion not found." }, { status: 404 });
  if (body?.action === "share") {
    db.prepare("UPDATE promotions SET status = 'Shared', sharing_date = ?, sharing_channel = ? WHERE id = ?").run(new Date().toISOString(), body.sharingChannel ?? "In store", id);
  } else if (body?.action === "draft") {
    db.prepare("UPDATE promotions SET status = 'Draft', saved_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  } else {
    if (!body?.title?.trim() || !["percent", "fixed"].includes(body.discountType ?? "") || !Number.isFinite(body.discountValue) || body.discountValue! <= 0 || !body.startDate || !body.endDate || new Date(body.endDate) < new Date(body.startDate) || (body.discountType === "percent" && body.discountValue! > 100)) {
      return NextResponse.json({ error: "Enter a title, valid discount, and date range." }, { status: 400 });
    }
    db.prepare("UPDATE promotions SET title = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ? WHERE id = ?").run(body.title.trim(), body.discountType, body.discountValue, body.startDate, body.endDate, id);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "manager") return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  const { id } = await params;
  getDb().prepare("DELETE FROM promotions WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}