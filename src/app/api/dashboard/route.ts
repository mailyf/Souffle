import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const db = getDb();
  const customerFilter = user.role === "customer" ? "WHERE o.customer_id = ?" : "";
  const orderParams = user.role === "customer" ? [user.customerId] : [];
  const orders = db.prepare(`
    SELECT o.id, o.order_date AS orderDate, o.order_type AS orderType, o.channel, o.status,
      o.subtotal, o.discount, o.total, o.estimated_ready_time AS estimatedReadyTime,
      o.confirmation_number AS confirmationNumber, o.promotion_id AS promotionId,
      COALESCE(c.first_name || ' ' || c.last_name, 'Walk-in') AS customerName,
      c.email AS customerEmail
    FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
    ${customerFilter} ORDER BY o.order_date DESC LIMIT 100
  `).all(...orderParams) as Array<Record<string, unknown> & { id: string }>;
  const lines = db.prepare("SELECT item_name AS name, quantity, special_instructions AS instructions, line_total AS total FROM order_lines WHERE order_id = ?");
  const ordersWithLines = orders.map((order) => ({ ...order, lines: lines.all(order.id) }));
  const menuItems = db.prepare("SELECT id, name, description, category, price, available FROM menu_items ORDER BY name").all();
  const inventory = db.prepare("SELECT id, name, unit, quantity, minimum_quantity AS minimumQuantity, updated_at AS updatedAt FROM inventory_items ORDER BY name").all();
  const promotions = db.prepare("SELECT id, title, discount_type AS discountType, discount_value AS discountValue, start_date AS startDate, end_date AS endDate, status, saved_at AS savedAt, sharing_date AS sharingDate, sharing_channel AS sharingChannel FROM promotions ORDER BY saved_at DESC").all();
  const payments = user.role === "customer"
    ? db.prepare("SELECT p.id, p.order_id AS orderId, p.amount, p.method, p.payment_date AS paymentDate, p.status, r.receipt_number AS receiptNumber FROM payments p LEFT JOIN receipts r ON r.payment_id = p.id JOIN orders o ON o.id = p.order_id WHERE o.customer_id = ? ORDER BY p.payment_date DESC").all(user.customerId)
    : db.prepare("SELECT p.id, p.order_id AS orderId, p.amount, p.method, p.payment_date AS paymentDate, p.status, r.receipt_number AS receiptNumber FROM payments p LEFT JOIN receipts r ON r.payment_id = p.id ORDER BY p.payment_date DESC").all();
  const employees = user.role === "manager"
    ? db.prepare(`SELECT e.id, e.first_name AS firstName, e.last_name AS lastName, e.email, e.phone, e.status, e.hire_date AS hireDate, e.role,
        (SELECT COUNT(*) FROM schedules s WHERE s.employee_id = e.id) AS scheduleCount,
        (SELECT COUNT(*) FROM paychecks p WHERE p.employee_id = e.id) AS paycheckCount
      FROM employees e ORDER BY e.first_name`).all()
    : [];
  const customers = user.role === "manager"
    ? db.prepare("SELECT id, first_name AS firstName, last_name AS lastName, email, phone, points FROM customers ORDER BY first_name").all()
    : [];
  const stats = user.role === "customer"
    ? { revenue: 0, orders: orders.length, averageOrder: 0, unitsSold: 0 }
    : db.prepare(`SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders,
        COALESCE(ROUND(AVG(total)), 0) AS averageOrder,
        COALESCE(SUM((SELECT SUM(quantity) FROM order_lines l WHERE l.order_id = o.id)), 0) AS unitsSold
      FROM orders o WHERE status = 'Completed' AND date(order_date) >= date('now', 'start of month')`).get();
  const chart = db.prepare(`SELECT date(order_date) AS day, SUM(total) AS revenue
    FROM orders WHERE status = 'Completed' AND date(order_date) >= date('now', '-6 days')
    GROUP BY date(order_date) ORDER BY day`).all();
  const schedules = user.role === "manager" || user.role === "employee"
    ? db.prepare(`SELECT s.id, s.employee_id AS employeeId, e.first_name || ' ' || e.last_name AS employeeName,
        s.start_time AS startTime, s.end_time AS endTime, s.schedule_start_date AS startDate, s.schedule_end_date AS endDate
      FROM schedules s JOIN employees e ON e.id = s.employee_id ORDER BY s.start_time`).all()
    : [];

  return NextResponse.json({ user, stats, chart, orders: ordersWithLines, menuItems, inventory, promotions, payments, employees, customers, schedules });
}