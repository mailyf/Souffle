import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getDb, passwordHash } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user || user.role === "customer") return NextResponse.json({ error: "Employee access is required." }, { status: 403 });
  const db = getDb();
  const employees = user.role === "manager"
    ? db.prepare("SELECT id, first_name AS firstName, last_name AS lastName, email, phone, status, hire_date AS hireDate, role FROM employees ORDER BY first_name").all()
    : db.prepare("SELECT id, first_name AS firstName, last_name AS lastName, email, phone, status, hire_date AS hireDate, role FROM employees WHERE id = ?").all(user.employeeId);
  return NextResponse.json({ employees });
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "manager") return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { firstName?: string; lastName?: string; email?: string; phone?: string; password?: string; role?: string } | null;
  if (!body?.firstName?.trim() || !body.lastName?.trim() || !body.email?.includes("@") || !body.password || body.password.length < 8 || !["employee", "manager"].includes(body.role ?? "")) {
    return NextResponse.json({ error: "Enter a name, valid email, role, and password of at least 8 characters." }, { status: 400 });
  }
  const firstName = body.firstName.trim();
  const lastName = body.lastName.trim();
  const email = body.email.trim().toLowerCase();
  const password = body.password;
  const role = body.role as "employee" | "manager";
  const db = getDb();
  if (db.prepare("SELECT 1 FROM accounts WHERE lower(email) = lower(?)").get(email)) return NextResponse.json({ error: "An account already uses that email." }, { status: 409 });
  const id = `EMP-${randomBytes(3).toString("hex").toUpperCase()}`;
  const accountId = `ACC-${randomBytes(3).toString("hex").toUpperCase()}`;
  const create = db.transaction(() => {
    db.prepare("INSERT INTO employees (id, first_name, last_name, email, phone, status, hire_date, role) VALUES (?, ?, ?, ?, ?, 'Active', ?, ?)")
      .run(id, firstName, lastName, email, body.phone?.trim() ?? "", new Date().toISOString().slice(0, 10), role);
    db.prepare("INSERT INTO accounts (id, email, password_hash, status, role, employee_id) VALUES (?, ?, ?, 'Active', ?, ?)")
      .run(accountId, email, passwordHash(password), role, id);
  });
  create();
  return NextResponse.json({ id, accountId }, { status: 201 });
}