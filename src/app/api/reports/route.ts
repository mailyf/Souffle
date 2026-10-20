import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function xmlCell(value: string | number) {
  const text = String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const type = typeof value === "number" ? "Number" : "String";
  return `<Cell><Data ss:Type="${type}">${text}</Data></Cell>`;
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user || user.role !== "manager") return NextResponse.json({ error: "Manager access is required." }, { status: 403 });
  const query = new URL(request.url).searchParams;
  const from = query.get("from") ?? new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const to = query.get("to") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  }
  const db = getDb();
  const sales = db.prepare(`SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders,
      COALESCE(ROUND(AVG(total)), 0) AS averageOrder,
      COALESCE(SUM((SELECT SUM(quantity) FROM order_lines l WHERE l.order_id = o.id)), 0) AS unitsSold
    FROM orders o WHERE status = 'Completed' AND date(order_date) BETWEEN date(?) AND date(?)`).get(from, to);
  const inventory = db.prepare("SELECT COUNT(*) AS belowMinimum FROM inventory_items WHERE quantity < minimum_quantity").get();
  const loyalty = db.prepare(`SELECT COUNT(*) AS registeredCustomers,
      COUNT(DISTINCT CASE WHEN purchases.purchaseCount > 1 THEN c.id END) AS repeatPurchases,
      COALESCE(SUM(events.points_issued), 0) AS pointsIssued,
      COALESCE(SUM(events.points_redeemed), 0) AS pointsRedeemed
    FROM customers c
    LEFT JOIN (SELECT customer_id, COUNT(*) AS purchaseCount FROM orders WHERE status = 'Completed' AND date(order_date) BETWEEN date(?) AND date(?) GROUP BY customer_id) purchases ON purchases.customer_id = c.id
    LEFT JOIN loyalty_events events ON events.customer_id = c.id AND date(events.created_at) BETWEEN date(?) AND date(?)`).get(from, to, from, to);
  const byDay = db.prepare(`SELECT date(order_date) AS day, SUM(total) AS revenue, COUNT(*) AS orders
    FROM orders WHERE status = 'Completed' AND date(order_date) BETWEEN date(?) AND date(?) GROUP BY date(order_date) ORDER BY day`).all(from, to);
  const bestSellers = db.prepare(`SELECT l.item_name AS name, SUM(l.quantity) AS quantity, SUM(l.line_total) AS revenue
    FROM order_lines l JOIN orders o ON o.id = l.order_id WHERE o.status = 'Completed' AND date(o.order_date) BETWEEN date(?) AND date(?)
    GROUP BY l.item_name ORDER BY quantity DESC LIMIT 5`).all(from, to);
  const result = { range: { from, to }, sales, inventory, loyalty, byDay, bestSellers };
  const rows: Array<Array<string | number>> = [
    ["Report", "Metric", "Value"],
    ["Period", "From", from],
    ["Period", "To", to],
    ["Sales", "Total revenue (JPY)", (sales as { revenue: number }).revenue],
    ["Sales", "Orders", (sales as { orders: number }).orders],
    ["Sales", "Units sold", (sales as { unitsSold: number }).unitsSold],
    ["Sales", "Average order (JPY)", (sales as { averageOrder: number }).averageOrder],
    ["Inventory", "Items below minimum", (inventory as { belowMinimum: number }).belowMinimum],
    ["Loyalty", "Registered customers", (loyalty as { registeredCustomers: number }).registeredCustomers],
    ["Loyalty", "Repeat purchasers", (loyalty as { repeatPurchases: number }).repeatPurchases],
    ["Loyalty", "Points issued", (loyalty as { pointsIssued: number }).pointsIssued],
    ["Loyalty", "Points redeemed", (loyalty as { pointsRedeemed: number }).pointsRedeemed],
    ["Daily sales", "Date · revenue (JPY) · orders", ""],
    ...(byDay as Array<{ day: string; revenue: number; orders: number }>).map((row) => ["Daily sales", row.day, `${row.revenue} JPY · ${row.orders} orders`]),
    ["Best sellers", "Item · units · revenue (JPY)", ""],
    ...(bestSellers as Array<{ name: string; quantity: number; revenue: number }>).map((row) => ["Best sellers", row.name, `${row.quantity} units · ${row.revenue} JPY`]),
  ];
  if (query.get("format") === "csv") {
    const output = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new Response(output, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="souffle-report-${from}-${to}.csv"` } });
  }
  if (query.get("format") === "excel") {
    const output = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Souffle report"><Table>${rows.map((row) => `<Row>${row.map(xmlCell).join("")}</Row>`).join("")}</Table></Worksheet></Workbook>`;
    return new Response(output, { headers: { "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": `attachment; filename="souffle-report-${from}-${to}.xls"` } });
  }
  return NextResponse.json(result);
}