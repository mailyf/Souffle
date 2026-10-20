import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type Role = "customer" | "employee" | "manager";

const globalForDb = globalThis as typeof globalThis & { souffleDb?: Database.Database };

export function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function seed(db: Database.Database) {
  const accounts = db.prepare("SELECT COUNT(*) AS count FROM accounts").get() as { count: number };
  if (accounts.count > 0) return;

  const today = new Date();
  const date = (daysAgo: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() - daysAgo);
    return value.toISOString();
  };

  const insertEmployee = db.prepare(
    "INSERT INTO employees (id, first_name, last_name, email, phone, status, hire_date, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insertEmployee.run("EMP-001", "Emi", "Tanaka", "manager@souffle.jp", "+81 90-1111-2200", "Active", "2022-04-12", "manager");
  insertEmployee.run("EMP-002", "Ren", "Sato", "employee@souffle.jp", "+81 90-2222-3300", "Active", "2024-08-05", "employee");
  insertEmployee.run("EMP-003", "Mio", "Kobayashi", "mio@souffle.jp", "+81 90-3333-4400", "Active", "2025-02-18", "employee");

  const insertCustomer = db.prepare(
    "INSERT INTO customers (id, first_name, last_name, email, phone, points, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  [
    ["CUS-001", "Yui", "Nakamura", "yui@example.jp", "+81 80-1111-0001", 420],
    ["CUS-002", "Haruto", "Ito", "haruto@example.jp", "+81 80-1111-0002", 180],
    ["CUS-003", "Sakura", "Watanabe", "sakura@example.jp", "+81 80-1111-0003", 720],
    ["CUS-004", "Kaito", "Yamamoto", "kaito@example.jp", "+81 80-1111-0004", 90],
    ["CUS-005", "Hana", "Suzuki", "hana@example.jp", "+81 80-1111-0005", 310],
  ].forEach((row, index) => insertCustomer.run(...row, date(180 - index * 18)));

  const insertAccount = db.prepare(
    "INSERT INTO accounts (id, email, password_hash, status, role, employee_id, customer_id) VALUES (?, ?, ?, 'Active', ?, ?, ?)",
  );
  const demoPassword = passwordHash("souffle2026", "souffle-demo-salt");
  insertAccount.run("ACC-001", "manager@souffle.jp", demoPassword, "manager", "EMP-001", null);
  insertAccount.run("ACC-002", "employee@souffle.jp", demoPassword, "employee", "EMP-002", null);
  insertAccount.run("ACC-003", "customer@souffle.jp", demoPassword, "customer", null, "CUS-001");

  const menu = db.prepare(
    "INSERT INTO menu_items (id, name, description, category, price, available) VALUES (?, ?, ?, ?, ?, 1)",
  );
  [
    ["MENU-01", "Classic Soufflé", "Our signature cloud-light cheesecake", "Whole cake", 3800],
    ["MENU-02", "Matcha Garden", "Uji matcha with a white chocolate finish", "Whole cake", 4400],
    ["MENU-03", "Strawberry Shortcake", "Seasonal berries and vanilla cream", "Whole cake", 4600],
    ["MENU-04", "Mini Soufflé Set", "Six petite cheesecakes for sharing", "Gift set", 2400],
    ["MENU-05", "Yuzu Cheesecake", "Bright citrus with a buttery biscuit base", "Whole cake", 4200],
  ].forEach((row) => menu.run(...row));

  const inventory = db.prepare(
    "INSERT INTO inventory_items (id, name, unit, quantity, minimum_quantity, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  [
    ["INV-01", "Cream cheese", "kg", 8.4, 5],
    ["INV-02", "Free-range eggs", "dozen", 4, 6],
    ["INV-03", "Cake flour", "kg", 12, 4],
    ["INV-04", "Uji matcha", "kg", 1.2, 1.5],
    ["INV-05", "Fresh strawberries", "kg", 3.8, 2],
    ["INV-06", "Unsalted butter", "kg", 6.5, 3],
    ["INV-07", "Heavy cream", "L", 3, 4],
    ["INV-08", "Yuzu", "kg", 2.3, 1.5],
  ].forEach((row) => inventory.run(...row, date(0)));

  const promotion = db.prepare(
    "INSERT INTO promotions (id, title, discount_type, discount_value, start_date, end_date, status, saved_at, sharing_date, sharing_channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  promotion.run("PROMO-01", "A little birthday magic", "percent", 10, date(-30), date(-1), "Shared", date(20), date(20), "Instagram");
  promotion.run("PROMO-02", "Autumn tea pairing", "fixed", 500, date(0), date(-21), "Shared", date(4), date(4), "In-store");
  promotion.run("PROMO-03", "New season, new soufflé", "percent", 15, date(0), date(-30), "Draft", date(1), null, null);

  const insertOrder = db.prepare(
    "INSERT INTO orders (id, customer_id, employee_id, order_date, order_type, channel, status, subtotal, discount, total, estimated_ready_time, confirmation_number, promotion_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const orderSeeds = [
    ["ORD-1048", "CUS-001", 0, "Pickup", "Online", "In Kitchen", 8400],
    ["ORD-1047", "CUS-003", 0, "Pickup", "Online", "Ready", 4600],
    ["ORD-1046", "CUS-002", 1, "Pickup", "Online", "Pending", 3800],
    ["ORD-1045", "CUS-005", 2, "Delivery", "Phone", "Completed", 9000],
    ["ORD-1044", "CUS-001", 0, "Pickup", "Online", "Completed", 6200],
    ["ORD-1043", "CUS-004", 1, "Pickup", "In store", "Completed", 4400],
    ["ORD-1042", "CUS-003", 0, "Delivery", "Online", "Completed", 8400],
    ["ORD-1041", "CUS-002", 1, "Pickup", "Phone", "Completed", 4600],
    ["ORD-1040", "CUS-005", 2, "Pickup", "Online", "Completed", 3800],
    ["ORD-1039", "CUS-001", 0, "Pickup", "In store", "Completed", 7000],
    ["ORD-1038", "CUS-003", 1, "Delivery", "Online", "Completed", 9200],
    ["ORD-1037", "CUS-004", 2, "Pickup", "Phone", "Completed", 4200],
  ] as const;
  const insertLine = db.prepare(
    "INSERT INTO order_lines (order_id, menu_item_id, item_name, quantity, special_instructions, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPayment = db.prepare(
    "INSERT INTO payments (id, order_id, amount, method, payment_date, status, card_type, authorization_code, cash_received, change_due) VALUES (?, ?, ?, ?, ?, 'Paid', ?, ?, ?, ?)",
  );
  const insertReceipt = db.prepare(
    "INSERT INTO receipts (id, payment_id, receipt_number, issued_at, total_paid) VALUES (?, ?, ?, ?, ?)",
  );
  orderSeeds.forEach(([id, customerId, employee, type, channel, status, total], index) => {
    const orderDate = date(index < 3 ? 0 : Math.floor((index - 2) / 2));
    insertOrder.run(id, customerId, `EMP-00${employee + 1}`, orderDate, type, channel, status, total, 0, total, new Date(Date.now() + 45 * 60000).toISOString(), `SF${id.slice(-4)}K`, null);
    const menuItem = ["MENU-01", "MENU-02", "MENU-03", "MENU-04", "MENU-05"][index % 5];
    const menuPrice = db.prepare("SELECT price FROM menu_items WHERE id = ?").get(menuItem) as { price: number };
    const item = db.prepare("SELECT name FROM menu_items WHERE id = ?").get(menuItem) as { name: string };
    const quantity = Math.max(1, Math.round(total / menuPrice.price));
    insertLine.run(id, menuItem, item.name, quantity, index === 0 ? "Happy 30th, Aiko! Please add gold lettering." : "", menuPrice.price, total);
    if (status === "Completed") {
      const paymentId = `PAY-${id.slice(-4)}`;
      const isCash = index % 3 === 0;
      insertPayment.run(paymentId, id, total, isCash ? "Cash" : "Card", orderDate, isCash ? null : "Visa", isCash ? null : `AUTH${id.slice(-4)}`, isCash ? total + 1000 : null, isCash ? 1000 : null);
      insertReceipt.run(`REC-${id.slice(-4)}`, paymentId, `RCPT-${id.slice(-4)}`, orderDate, total);
    }
  });

  const schedule = db.prepare("INSERT INTO schedules (id, employee_id, start_time, end_time, schedule_start_date, schedule_end_date) VALUES (?, ?, ?, ?, ?, ?)");
  schedule.run("SCH-001", "EMP-002", "09:00", "17:00", date(-2), date(5));
  schedule.run("SCH-002", "EMP-003", "11:00", "19:00", date(-2), date(5));
  const paycheck = db.prepare("INSERT INTO paychecks (id, employee_id, hours_worked, amount, period_start, period_end, issue_date) VALUES (?, ?, ?, ?, ?, ?, ?)");
  paycheck.run("CHK-001", "EMP-002", 78.5, 117750, date(30), date(16), date(12));
  paycheck.run("CHK-002", "EMP-003", 72, 108000, date(30), date(16), date(12));
}

export function getDb() {
  if (globalForDb.souffleDb) return globalForDb.souffleDb;

  const location = process.env.SOUFFLE_DB_PATH ?? path.join(process.cwd(), "data", "souffle.sqlite");
  fs.mkdirSync(path.dirname(location), { recursive: true });
  const db = new Database(location);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL, status TEXT NOT NULL, hire_date TEXT NOT NULL, role TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, status TEXT NOT NULL, role TEXT NOT NULL, employee_id TEXT REFERENCES employees(id), customer_id TEXT REFERENCES customers(id));
    CREATE TABLE IF NOT EXISTS menu_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, available INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_id TEXT REFERENCES customers(id), employee_id TEXT REFERENCES employees(id), order_date TEXT NOT NULL, order_type TEXT NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL, subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, estimated_ready_time TEXT NOT NULL, confirmation_number TEXT NOT NULL UNIQUE, promotion_id TEXT REFERENCES promotions(id));
    CREATE TABLE IF NOT EXISTS order_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, menu_item_id TEXT NOT NULL REFERENCES menu_items(id), item_name TEXT NOT NULL, quantity INTEGER NOT NULL, special_instructions TEXT NOT NULL DEFAULT '', unit_price INTEGER NOT NULL, line_total INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), amount INTEGER NOT NULL, method TEXT NOT NULL, payment_date TEXT NOT NULL, status TEXT NOT NULL, card_type TEXT, authorization_code TEXT, cash_received INTEGER, change_due INTEGER);
    CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id), receipt_number TEXT NOT NULL UNIQUE, issued_at TEXT NOT NULL, total_paid INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS inventory_items (id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL, quantity REAL NOT NULL, minimum_quantity REAL NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS promotions (id TEXT PRIMARY KEY, title TEXT NOT NULL, discount_type TEXT NOT NULL, discount_value INTEGER NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL, saved_at TEXT NOT NULL, sharing_date TEXT, sharing_channel TEXT);
    CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), start_time TEXT NOT NULL, end_time TEXT NOT NULL, schedule_start_date TEXT NOT NULL, schedule_end_date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS paychecks (id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), hours_worked REAL NOT NULL, amount INTEGER NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, issue_date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS loyalty_events (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT NOT NULL REFERENCES customers(id), order_id TEXT NOT NULL REFERENCES orders(id), points_issued INTEGER NOT NULL DEFAULT 0, points_redeemed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
  `);
  seed(db);
  globalForDb.souffleDb = db;
  return db;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && Buffer.from(actual).equals(Buffer.from(expected));
}