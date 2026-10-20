import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ promotions: getDb().prepare("SELECT id, title, discount_type AS discountType, discount_value AS discountValue, start_date AS startDate, end_date AS endDate, status, saved_at AS savedAt, sharing_date AS sharingDate, sharing_channel AS sharingChannel FROM promotions ORDER BY saved_at DESC").all() });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "manager") return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { title?: string; discountType?: string; discountValue?: number; startDate?: string; endDate?: string; status?: string; sharingChannel?: string } | null;
  if (!body?.title?.trim() || !["percent", "fixed"].includes(body.discountType ?? "") || !Number.isFinite(body.discountValue) || body.discountValue! <= 0 || !body.startDate || !body.endDate || new Date(body.endDate) < new Date(body.startDate)) {
    return NextResponse.json({ error: "Enter a title, valid discount, and date range." }, { status: 400 });
  }
  if (body.discountType === "percent" && body.discountValue! > 100) return NextResponse.json({ error: "Percent discounts cannot exceed 100%." }, { status: 400 });
  const id = `PROMO-${randomBytes(3).toString("hex").toUpperCase()}`;
  const now = new Date().toISOString();
  const shared = body.status === "Shared";
  getDb().prepare("INSERT INTO promotions (id, title, discount_type, discount_value, start_date, end_date, status, saved_at, sharing_date, sharing_channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, body.title.trim(), body.discountType, body.discountValue, body.startDate, body.endDate, shared ? "Shared" : "Draft", now, shared ? now : null, shared ? body.sharingChannel ?? "In store" : null);
  return NextResponse.json({ id }, { status: 201 });
}