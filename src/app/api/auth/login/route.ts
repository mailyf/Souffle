import { NextResponse } from "next/server";
import { getDb, verifyPassword } from "@/lib/db";
import { createToken, setSessionCookie, type Session } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  if (!body?.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const account = getDb().prepare(`
    SELECT a.id AS accountId, a.email, a.password_hash AS passwordHash, a.role, a.employee_id AS employeeId,
      a.customer_id AS customerId, COALESCE(e.first_name || ' ' || e.last_name, c.first_name || ' ' || c.last_name, 'Guest') AS name
    FROM accounts a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN customers c ON c.id = a.customer_id
    WHERE lower(a.email) = lower(?) AND a.status = 'Active'
  `).get(body.email.trim()) as (Session & { passwordHash: string }) | undefined;

  if (!account || !verifyPassword(body.password, account.passwordHash)) {
    return NextResponse.json({ error: "That email and password do not match." }, { status: 401 });
  }

  const session: Session = {
    accountId: account.accountId,
    email: account.email,
    name: account.name,
    role: account.role,
    customerId: account.customerId,
    employeeId: account.employeeId,
  };
  await setSessionCookie(createToken(session));
  return NextResponse.json({ user: session });
}