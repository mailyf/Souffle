import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  const { id } = await params;
  if (!user || user.role === "customer" || (user.role !== "manager" && user.employeeId !== id)) return NextResponse.json({ error: "Employee access is required." }, { status: 403 });
  const db = getDb();
  const employee = db.prepare("SELECT id, first_name AS firstName, last_name AS lastName, email, phone, status, hire_date AS hireDate, role FROM employees WHERE id = ?").get(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  const schedules = db.prepare("SELECT id, start_time AS startTime, end_time AS endTime, schedule_start_date AS startDate, schedule_end_date AS endDate FROM schedules WHERE employee_id = ? ORDER BY schedule_start_date DESC").all(id);
  const paychecks = db.prepare("SELECT id, hours_worked AS hoursWorked, amount, period_start AS periodStart, period_end AS periodEnd, issue_date AS issueDate FROM paychecks WHERE employee_id = ? ORDER BY issue_date DESC").all(id);
  const account = db.prepare("SELECT id, email, status FROM accounts WHERE employee_id = ?").get(id);
  return NextResponse.json({ employee, account, schedules, paychecks });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "manager") return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as { firstName?: string; lastName?: string; email?: string; phone?: string; status?: string } | null;
  const db = getDb();
  const employee = db.prepare("SELECT id FROM employees WHERE id = ?").get(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  if (body?.status && !["Active", "Inactive"].includes(body.status)) return NextResponse.json({ error: "Invalid employee status." }, { status: 400 });
  const fields = {
    firstName: body?.firstName?.trim(), lastName: body?.lastName?.trim(), email: body?.email?.trim().toLowerCase(), phone: body?.phone?.trim(), status: body?.status,
  };
  const update = db.transaction(() => {
    db.prepare("UPDATE employees SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), email = COALESCE(?, email), phone = COALESCE(?, phone), status = COALESCE(?, status) WHERE id = ?")
      .run(fields.firstName ?? null, fields.lastName ?? null, fields.email ?? null, fields.phone ?? null, fields.status ?? null, id);
    if (fields.email || fields.status) {
      db.prepare("UPDATE accounts SET email = COALESCE(?, email), status = COALESCE(?, status) WHERE employee_id = ?")
        .run(fields.email ?? null, fields.status ?? null, id);
    }
  });
  try {
    update();
  } catch {
    return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "manager") return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  const { id } = await params;
  const db = getDb();
  const deactivate = db.transaction(() => {
    db.prepare("UPDATE employees SET status = 'Inactive' WHERE id = ?").run(id);
    db.prepare("UPDATE accounts SET status = 'Inactive' WHERE employee_id = ?").run(id);
  });
  deactivate();
  return NextResponse.json({ ok: true });
}