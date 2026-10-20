"use client";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BadgePercent,
  Bell,
  CakeSlice,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileBarChart2,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FormEvent, useEffect, useState } from "react";

type Role = "customer" | "employee" | "manager";
type User = {
  accountId: string;
  email: string;
  name: string;
  role: Role;
  customerId: string | null;
  employeeId: string | null;
};
type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  available: number;
};
type Order = {
  id: string;
  orderDate: string;
  orderType: string;
  channel: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  estimatedReadyTime: string;
  confirmationNumber: string;
  customerName: string;
  customerEmail: string;
  promotionId: string | null;
  lines: Array<{
    name: string;
    quantity: number;
    instructions: string;
    total: number;
  }>;
};
type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minimumQuantity: number;
  updatedAt: string;
};
type Promotion = {
  id: string;
  title: string;
  discountType: string;
  discountValue: number;
  startDate: string;
  endDate: string;
  status: string;
  savedAt: string;
  sharingDate: string | null;
  sharingChannel: string | null;
};
type Payment = {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  paymentDate: string;
  status: string;
  receiptNumber: string | null;
};
type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  hireDate: string;
  role: Role;
  scheduleCount: number;
  paycheckCount: number;
};
type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  points: number;
};
type Dashboard = {
  user: User;
  stats: {
    revenue: number;
    orders: number;
    averageOrder: number;
    unitsSold: number;
  };
  chart: Array<{ day: string; revenue: number }>;
  orders: Order[];
  menuItems: MenuItem[];
  inventory: InventoryItem[];
  promotions: Promotion[];
  payments: Payment[];
  employees: Employee[];
  customers: Customer[];
  schedules: Array<{
    id: string;
    employeeName: string;
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
  }>;
};
type ReportData = {
  range: { from: string; to: string };
  sales: {
    revenue: number;
    orders: number;
    averageOrder: number;
    unitsSold: number;
  };
  inventory: { belowMinimum: number };
  loyalty: {
    registeredCustomers: number;
    repeatPurchases: number;
    pointsIssued: number;
    pointsRedeemed: number;
  };
  byDay: Array<{ day: string; revenue: number; orders: number }>;
  bestSellers: Array<{ name: string; quantity: number; revenue: number }>;
};
type Page =
  | "overview"
  | "orders"
  | "payments"
  | "team"
  | "inventory"
  | "promotions"
  | "reports";
const yen = (value: number) => `¥${Math.round(value).toLocaleString("ja-JP")}`;
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(
    new Date(value),
  );
const longDate = () =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
const today = new Date();
const defaultReportTo = today.toISOString().slice(0, 10);
const reportStart = new Date(today);
reportStart.setDate(reportStart.getDate() - 29);
const defaultReportFrom = reportStart.toISOString().slice(0, 10);
const defaultPromotionEnd = new Date(today.getTime() + 14 * 86400000)
  .toISOString()
  .slice(0, 10);
const nav: Array<{
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
  manager?: boolean;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "payments", label: "Payments", icon: WalletCards },
  { id: "team", label: "Team", icon: Users, manager: true },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "promotions", label: "Promotions", icon: BadgePercent, manager: true },
  { id: "reports", label: "Reports", icon: FileBarChart2, manager: true },
];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
  return body as T;
}

export default function SouffleConsole() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("overview");
  const [email, setEmail] = useState("manager@souffle.jp");
  const [password, setPassword] = useState("souffle2026");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    null | "order" | "payment" | "promotion" | "employee"
  >(null);
  const [modalOrder, setModalOrder] = useState<Order | undefined>();
  const [modalPromotion, setModalPromotion] = useState<Promotion | undefined>();
  const [reportRange, setReportRange] = useState({
    from: defaultReportFrom,
    to: defaultReportTo,
  });
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportRevision, setReportRevision] = useState(0);

  async function refresh() {
    const result = await api<Dashboard>("/api/dashboard");
    setData(result);
    setUser(result.user);
  }
  useEffect(() => {
    api<{ user: User }>("/api/auth/session")
      .then(refresh)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user?.role !== "manager" || page !== "reports") return;
    api<ReportData>(
      `/api/reports?from=${reportRange.from}&to=${reportRange.to}`,
    )
      .then(setReport)
      .catch(() => setReport(null));
  }, [user, page, reportRange.from, reportRange.to, reportRevision]);
  async function signIn(e?: FormEvent, quickEmail?: string) {
    e?.preventDefault();
    setError("");
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: quickEmail ?? email,
          password: quickEmail ? "souffle2026" : password,
        }),
      });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in.");
    }
  }
  async function signOut() {
    await api("/api/auth/session", { method: "DELETE" });
    setUser(null);
    setData(null);
    setPage("overview");
  }
  async function act(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      await refresh();
      setToast(message);
      setModal(null);
    } catch (reason) {
      setToast(
        reason instanceof Error
          ? reason.message
          : "Action could not be completed.",
      );
    }
    window.setTimeout(() => setToast(""), 3500);
  }
  if (loading)
    return (
      <div className="boot-screen">
        <span className="brand-mark">
          <CakeSlice size={18} />
        </span>
        Preparing the bakery...
      </div>
    );
  if (!user || !data)
    return (
      <Login
        email={email}
        password={password}
        error={error}
        setEmail={setEmail}
        setPassword={setPassword}
        onSubmit={signIn}
        onQuick={(value) => void signIn(undefined, value)}
      />
    );

  const availableNav = nav.filter(
    (item) => !item.manager || user.role === "manager",
  );
  const title =
    page === "overview"
      ? "Overview"
      : page.charAt(0).toUpperCase() + page.slice(1);
  const createOrder = () => {
    setModalOrder(undefined);
    setModal("order");
  };
  const payOrder = (order: Order) => {
    setModalOrder(order);
    setModal("payment");
  };
  return (
    <div className="app-frame">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <a
          className="brand"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            setPage("overview");
          }}
        >
          <span className="brand-mark">
            <CakeSlice size={19} />
          </span>
          <span className="brand-name">
            soufflé<small>BAKERY STUDIO</small>
          </span>
        </a>
        <div className="store-switch">
          <i />
          <span>
            <b>Daikanyama</b>
            <small>Tokyo · Flagship</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {availableNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-link ${page === id ? "active" : ""}`}
              onClick={() => {
                setPage(id);
                setMobileOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "orders" &&
                data.orders.some((order) =>
                  ["Pending", "In Kitchen"].includes(order.status),
                ) && (
                  <i className="nav-count">
                    {
                      data.orders.filter((order) =>
                        ["Pending", "In Kitchen"].includes(order.status),
                      ).length
                    }
                  </i>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="daily-note">
            <Sparkles size={15} />
            <span>
              Made slowly,
              <br />
              <b>shared gladly.</b>
            </span>
            <i>ふわり</i>
          </div>
          <button className="nav-link">
            <CalendarDays size={17} />
            <span>Schedule</span>
          </button>
          <button className="nav-link">
            <ShieldCheck size={17} />
            <span>Help & support</span>
          </button>
          <button className="profile-row" onClick={signOut}>
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <span>
              <b>{user.name}</b>
              <small>
                {user.role === "manager"
                  ? "Store manager"
                  : user.role === "employee"
                    ? "Bakery team"
                    : "Soufflé Club"}
              </small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open menu"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>Soufflé</span>
            <i>/</i>
            <b>{title}</b>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} />
              <input
                placeholder="Search anything"
                aria-label="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>
            <span className="topbar-divider" />
            <button className="topbar-user" onClick={signOut} title="Sign out">
              <span className="avatar avatar-small">{user.name[0]}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <div className="page-content">
          {page === "overview" && (
            <Overview
              data={data}
              user={user}
              navigate={setPage}
              newOrder={createOrder}
              pay={payOrder}
              update={(id, status) =>
                void act(
                  () =>
                    api(`/api/orders/${id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ status }),
                    }),
                  `Order ${id} updated.`,
                )
              }
            />
          )}
          {page === "orders" && (
            <Orders
              data={data}
              user={user}
              search={search}
              newOrder={createOrder}
              pay={payOrder}
              update={(id, status) =>
                void act(
                  () =>
                    api(`/api/orders/${id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ status }),
                    }),
                  `Order ${id} updated.`,
                )
              }
            />
          )}
          {page === "payments" && <Payments data={data} pay={payOrder} />}
          {page === "team" && (
            <Team data={data} add={() => setModal("employee")} />
          )}
          {page === "inventory" && (
            <Inventory
              data={data}
              role={user.role}
              save={(id, quantity, minimumQuantity) =>
                void act(
                  () =>
                    api("/api/inventory", {
                      method: "PATCH",
                      body: JSON.stringify({ id, quantity, minimumQuantity }),
                    }),
                  "Stock levels updated.",
                )
              }
            />
          )}
          {page === "promotions" && (
            <Promotions
              data={data}
              add={() => {
                setModalPromotion(undefined);
                setModal("promotion");
              }}
              edit={(promotion) => {
                setModalPromotion(promotion);
                setModal("promotion");
              }}
              act={(id, action) =>
                void act(
                  () =>
                    action === "delete"
                      ? api(`/api/promotions/${id}`, { method: "DELETE" })
                      : api(`/api/promotions/${id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ action }),
                        }),
                  action === "delete"
                    ? "Promotion removed."
                    : "Promotion shared with your customers.",
                )
              }
            />
          )}
          {page === "reports" && (
            <Reports
              data={data}
              report={report}
              range={reportRange}
              setRange={setReportRange}
              run={() => setReportRevision((revision) => revision + 1)}
            />
          )}
        </div>
      </main>
      {toast && (
        <div className="toast">
          <Activity size={16} />
          {toast}
          <button aria-label="Dismiss" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal onClose={() => setModal(null)}>
          {modal === "order" && (
            <OrderForm
              data={data}
              user={user}
              close={() => setModal(null)}
              submit={(body) =>
                void act(
                  () =>
                    api("/api/orders", {
                      method: "POST",
                      body: JSON.stringify(body),
                    }),
                  "Order created and sent to the kitchen.",
                )
              }
            />
          )}
          {modal === "payment" && (
            <PaymentForm
              data={data}
              order={modalOrder}
              close={() => setModal(null)}
              submit={(body) =>
                void act(
                  () =>
                    api("/api/payments", {
                      method: "POST",
                      body: JSON.stringify(body),
                    }),
                  "Payment complete. Receipt generated.",
                )
              }
            />
          )}
          {modal === "promotion" && (
            <PromotionForm
              promotion={modalPromotion}
              close={() => setModal(null)}
              submit={(body) =>
                void act(
                  () =>
                    modalPromotion
                      ? api(`/api/promotions/${modalPromotion.id}`, {
                          method: "PATCH",
                          body: JSON.stringify(body),
                        })
                      : api("/api/promotions", {
                          method: "POST",
                          body: JSON.stringify(body),
                        }),
                  modalPromotion ? "Promotion updated." : "Promotion saved.",
                )
              }
            />
          )}
          {modal === "employee" && (
            <EmployeeForm
              close={() => setModal(null)}
              submit={(body) =>
                void act(
                  () =>
                    api("/api/employees", {
                      method: "POST",
                      body: JSON.stringify(body),
                    }),
                  "Team account created.",
                )
              }
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function Login({
  email,
  password,
  error,
  setEmail,
  setPassword,
  onSubmit,
  onQuick,
}: {
  email: string;
  password: string;
  error: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onSubmit: (event?: FormEvent) => void;
  onQuick: (email: string) => void;
}) {
  return (
    <main className="login-screen">
      <section className="login-art">
        <div className="login-art-top">
          <a className="brand brand-light" href="#home">
            <span className="brand-mark">
              <CakeSlice size={19} />
            </span>
            <span className="brand-name">
              soufflé<small>BAKERY STUDIO</small>
            </span>
          </a>
          <span className="login-location">
            <i /> TOKYO · DAIKANYAMA
          </span>
        </div>
        <div className="login-art-copy">
          <span className="eyebrow light-eyebrow">
            <i /> THE LITTLE THINGS, MADE WELL
          </span>
          <h1>
            A softer kind
            <br />
            of <em>every day.</em>
          </h1>
          <p>
            Good things take a little time.
            <br />
            Here’s to the ones we make together.
          </p>
          <div className="art-stamp">
            <b>ふわり</b>
            <small>FRESH FROM OUR OVEN</small>
          </div>
        </div>
        <div className="login-art-footer">
          <span>EST. 2018</span>
          <span>MADE WITH CARE IN TOKYO</span>
          <span>01 — 06</span>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <CakeSlice size={19} /> soufflé
          </div>
          <div className="login-heading">
            <span className="eyebrow">
              <i /> YOUR BAKERY, AT A GLANCE
            </span>
            <h2>Welcome back.</h2>
            <p>Sign in to your Soufflé workspace.</p>
          </div>
          <form className="login-form" onSubmit={onSubmit}>
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="button button-primary login-submit">
              Sign in <ArrowRight size={16} />
            </button>
          </form>
          <div className="demo-login">
            <span className="demo-label">TRY A DEMO ACCOUNT</span>
            <div className="demo-options">
              {[
                { role: "manager", email: "manager@souffle.jp" },
                { role: "employee", email: "employee@souffle.jp" },
                { role: "customer", email: "customer@souffle.jp" },
              ].map((account) => (
                <button
                  key={account.role}
                  onClick={() => onQuick(account.email)}
                >
                  <i className={`demo-dot demo-${account.role}`} />
                  {account.role}
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
            <p>
              Password for all accounts: <b>souffle2026</b>
            </p>
          </div>
          <div className="login-legal">
            <span>© 2026 SOUFFLÉ BAKERY STUDIO</span>
            <span>MADE WITH CARE</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function PageHeading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">
          <i /> {eyebrow}
        </span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof WalletCards;
  tint: string;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className={`metric-icon ${tint}`}>
          <Icon size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="metric-change">{note}</div>
    </article>
  );
}
function Status({ status }: { status: string }) {
  return (
    <span
      className={`status-badge status-${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      <i />
      {status}
    </span>
  );
}

function Overview({
  data,
  user,
  navigate,
  newOrder,
  pay,
  update,
}: {
  data: Dashboard;
  user: User;
  navigate: (page: Page) => void;
  newOrder: () => void;
  pay: (order: Order) => void;
  update: (id: string, status: string) => void;
}) {
  const pending = data.orders.filter(
    (order) => !["Completed", "Cancelled"].includes(order.status),
  );
  const low = data.inventory.filter(
    (item) => item.quantity < item.minimumQuantity,
  );
  const chart = data.chart;
  if (user.role === "customer")
    return (
      <>
        <PageHeading
          eyebrow="YOUR SOUFFLÉ CLUB"
          title={`Hello, ${user.name.split(" ")[0]}.`}
          text="Your next little moment of joy starts here."
        >
          <button className="button button-primary" onClick={newOrder}>
            <Plus size={16} /> Place an order
          </button>
        </PageHeading>
        <section className="customer-hero">
          <div>
            <span className="eyebrow light-eyebrow">
              <i /> THE SOUFFLÉ CLUB
            </span>
            <h2>
              Little moments,
              <br />
              <em>well earned.</em>
            </h2>
            <p>Your points are ready when you are.</p>
            <strong>
              {(
                data.customers.find((c) => c.id === user.customerId)?.points ??
                420
              ).toLocaleString()}{" "}
              <small>points to something lovely</small>
            </strong>
          </div>
          <div
            className="customer-hero-image"
            role="img"
            aria-label="Souffle cheesecake"
          />
        </section>
        <div className="section-head">
          <div>
            <span className="eyebrow">MADE JUST FOR YOU</span>
            <h2>Your orders</h2>
          </div>
        </div>
        <section className="panel">
          {data.orders
            .filter((o) => !["Completed", "Cancelled"].includes(o.status))
            .map((order) => (
              <div className="unpaid-row" key={order.id}>
                <CakeSlice size={20} />
                <span>
                  <b>
                    {order.id} ·{" "}
                    {order.lines.map((line) => line.name).join(", ")}
                  </b>
                  <small>
                    {order.confirmationNumber} · Ready{" "}
                    {new Date(order.estimatedReadyTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </span>
                <Status status={order.status} />
                <strong>{yen(order.total)}</strong>
                {!data.payments.some((p) => p.orderId === order.id) && (
                  <button
                    className="button button-outline button-small"
                    onClick={() => pay(order)}
                  >
                    Pay now
                  </button>
                )}
              </div>
            ))}
        </section>
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="TUESDAY, FRESHLY PREPARED"
        title={`Good morning, ${user.name.split(" ")[0]}.`}
        text={`${longDate()} · Daikanyama store`}
      >
        <button
          className="button button-outline"
          onClick={() => navigate("reports")}
        >
          <FileBarChart2 size={15} /> View reports
        </button>
        <button className="button button-primary" onClick={newOrder}>
          <Plus size={16} /> New order
        </button>
      </PageHeading>
      <section className="metric-grid">
        <Metric
          label="Net sales"
          value={yen(data.stats.revenue)}
          note="This month · completed sales"
          icon={WalletCards}
          tint="mint"
        />
        <Metric
          label="Orders today"
          value={String(
            pending.length +
              data.orders.filter((o) => o.status === "Completed").length,
          )}
          note={`${pending.length} in progress`}
          icon={ShoppingBag}
          tint="coral"
        />
        <Metric
          label="Average order"
          value={yen(data.stats.averageOrder)}
          note={`${data.stats.unitsSold} items sold this month`}
          icon={ReceiptText}
          tint="yellow"
        />
        <Metric
          label="Needs attention"
          value={String(
            low.length +
              data.orders.filter((o) => o.status === "Pending").length,
          )}
          note={`${low.length} low-stock ingredients`}
          icon={Activity}
          tint="lilac"
        />
      </section>
      <section className="overview-grid">
        <article className="panel sales-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">THE DAILY RISE</span>
              <h2>Sales overview</h2>
            </div>
            <span className="period-select">
              This week <ChevronDown size={14} />
            </span>
          </div>
          <div className="sales-number">
            <strong>
              {yen(chart.reduce((sum, row) => sum + Number(row.revenue), 0))}
            </strong>
            <span className="trend-pill">↗ 12.8%</span>
            <small>Revenue · last 7 days</small>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chart}
                margin={{ top: 12, right: 4, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4c876c" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4c876c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#e9ece7"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={dateLabel}
                  tick={{ fill: "#8b9189", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v ? `¥${Math.round(v / 1000)}k` : "¥0"
                  }
                  tick={{ fill: "#8b9189", fontSize: 11 }}
                />
                <Tooltip formatter={(v) => [yen(Number(v)), "Sales"]} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4c876c"
                  strokeWidth={2.5}
                  fill="url(#fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span>
              <i /> Daily revenue
            </span>
            <button onClick={() => navigate("reports")}>
              View report <ArrowRight size={13} />
            </button>
          </div>
        </article>
        <article className="feature-panel">
          <div
            className="feature-photo"
            role="img"
            aria-label="Japanese cheesecake fresh from the oven"
          />
          <div className="feature-copy">
            <span className="eyebrow">A NOTE FROM THE OVEN</span>
            <h2>
              A good day
              <br />
              starts <em>soft.</em>
            </h2>
            <p>
              Today’s special is fresh out of the oven. Matcha Garden, finished
              by hand.
            </p>
            <button onClick={() => navigate("promotions")}>
              See what’s new <ArrowRight size={14} />
            </button>
          </div>
        </article>
      </section>
      <section className="lower-grid">
        <article className="panel orders-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">FRESH OFF THE TICKET</span>
              <h2>Recent orders</h2>
            </div>
            <button className="text-link" onClick={() => navigate("orders")}>
              All orders <ArrowRight size={14} />
            </button>
          </div>
          <OrdersTable
            orders={data.orders.slice(0, 5)}
            payments={data.payments}
            role={user.role}
            update={update}
            pay={pay}
          />
        </article>
        <article className="panel stock-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">PANTRY CHECK</span>
              <h2>Stock to watch</h2>
            </div>
            <button
              className="icon-button"
              aria-label="Inventory"
              onClick={() => navigate("inventory")}
            >
              <ArrowRight size={16} />
            </button>
          </div>
          {low.map((item) => (
            <div className="stock-item" key={item.id}>
              <Package size={16} />
              <span>
                <b>{item.name}</b>
                <small>
                  Min {item.minimumQuantity} {item.unit}
                </small>
              </span>
              <strong>
                {item.quantity} {item.unit}
              </strong>
            </div>
          ))}
          {!low.length && (
            <p className="empty-note">Everything is stocked up.</p>
          )}
          <button
            className="stock-footer"
            onClick={() => navigate("inventory")}
          >
            Manage inventory <ArrowRight size={14} />
          </button>
        </article>
      </section>
    </>
  );
}

function OrdersTable({
  orders,
  payments,
  role,
  update,
  pay,
}: {
  orders: Order[];
  payments: Payment[];
  role: Role;
  update: (id: string, status: string) => void;
  pay: (order: Order) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Items</th>
            <th>Ready by</th>
            <th>Total</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const paid = payments.some((p) => p.orderId === o.id);
            const next =
              o.status === "Pending"
                ? "In Kitchen"
                : o.status === "In Kitchen"
                  ? "Ready"
                  : "Completed";
            return (
              <tr key={o.id}>
                <td>
                  <b className="order-id">{o.id}</b>
                  <small>
                    {dateLabel(o.orderDate)} · {o.channel}
                  </small>
                </td>
                <td>
                  {o.customerName}
                  <small>{o.orderType}</small>
                </td>
                <td>
                  {o.lines.map((l) => `${l.quantity} × ${l.name}`).join(", ")}
                  {o.lines[0]?.instructions && (
                    <small className="instruction-note">
                      <Sparkles size={11} /> Custom request
                    </small>
                  )}
                </td>
                <td>
                  {o.status === "Completed"
                    ? "—"
                    : new Date(o.estimatedReadyTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  <small>{paid ? "Paid" : "Payment due"}</small>
                </td>
                <td>
                  <b>{yen(o.total)}</b>
                </td>
                <td>
                  <Status status={o.status} />
                </td>
                <td>
                  {o.status === "Cancellation Requested" ? (
                    role === "manager" ? (
                      <button className="button button-primary button-small" onClick={() => update(o.id, "Cancelled")}>Approve cancellation</button>
                    ) : <span>Awaiting approval</span>
                  ) : role === "customer" && ["Pending", "In Kitchen"].includes(o.status) ? (
                    <button className="button button-outline button-small" onClick={() => update(o.id, "Cancelled")}>Request cancel</button>
                  ) : role !== "customer" && !["Completed", "Cancelled"].includes(o.status) && !paid ? (
                    <button className="icon-action" aria-label={`Pay ${o.id}`} onClick={() => pay(o)}><WalletCards size={16} /></button>
                  ) : role !== "customer" && !["Completed", "Cancelled"].includes(o.status) && paid ? (
                    <button className="button button-outline button-small" onClick={() => update(o.id, next)}>{next === "In Kitchen" ? "Start" : next === "Ready" ? "Mark ready" : "Complete"}</button>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {!orders.length && (
            <tr>
              <td colSpan={7} className="empty-note">
                No orders found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Orders({
  data,
  user,
  search,
  newOrder,
  pay,
  update,
}: {
  data: Dashboard;
  user: User;
  search: string;
  newOrder: () => void;
  pay: (order: Order) => void;
  update: (id: string, status: string) => void;
}) {
  const [filter, setFilter] = useState("All orders");
  const filters = [
    "All orders",
    "In progress",
    "Ready",
    "Completed",
    "Cancelled",
  ];
  const orders = data.orders.filter(
    (o) =>
      (filter === "All orders" ||
        (filter === "In progress"
          ? ["Pending", "In Kitchen"].includes(o.status)
          : o.status === filter)) &&
      `${o.id} ${o.customerName} ${o.confirmationNumber} ${o.lines.map((l) => l.name)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="ORDER DESK"
        title={
          user.role === "customer" ? "Your orders." : "Orders, made to order."
        }
        text="Every custom cake starts with a good conversation."
      >
        <button className="button button-primary" onClick={newOrder}>
          <Plus size={15} /> New order
        </button>
      </PageHeading>
      <div className="toolbar-row">
        <div className="segmented-control">
          {filters.map((f) => (
            <button
              className={filter === f ? "selected" : ""}
              key={f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <section className="panel table-panel">
        <OrdersTable
          orders={orders}
          payments={data.payments}
          role={user.role}
          update={update}
          pay={pay}
        />
      </section>
    </>
  );
}

function Payments({
  data,
  pay,
}: {
  data: Dashboard;
  pay: (order: Order) => void;
}) {
  const unpaid = data.orders.filter(
    (o) =>
      !["Cancelled", "Completed"].includes(o.status) &&
      !data.payments.some((p) => p.orderId === o.id),
  );
  return (
    <>
      <PageHeading
        eyebrow="PAYMENT DESK"
        title="Every detail, accounted for."
        text="Record a payment and issue a receipt in one step."
      />
      <section className="payment-summary">
        <div>
          <span className="eyebrow light-eyebrow">
            <i /> THIS MONTH
          </span>
          <strong>
            {yen(data.payments.reduce((sum, p) => sum + p.amount, 0))}
          </strong>
          <span>{data.payments.length} completed transactions</span>
        </div>
        <div>
          <span>Card</span>
          <b>{data.payments.filter((p) => p.method === "Card").length}</b>
          <small>transactions</small>
        </div>
        <div>
          <span>Cash</span>
          <b>{data.payments.filter((p) => p.method === "Cash").length}</b>
          <small>transactions</small>
        </div>
      </section>
      <section className="panel payment-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">RECENT TRANSACTIONS</span>
            <h2>Payment history</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Order</th>
                <th>Paid on</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.receiptNumber ?? p.id}</b>
                  </td>
                  <td>{p.orderId}</td>
                  <td>
                    {new Date(p.paymentDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td>
                    {p.method}
                    {p.method === "Card" && <small> · Visa</small>}
                  </td>
                  <td>
                    <b>{yen(p.amount)}</b>
                  </td>
                  <td>
                    <Status status="Paid" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {unpaid.length > 0 && (
        <section className="panel unpaid-panel">
          <div className="panel-header">
            <h2>Awaiting payment</h2>
          </div>
          {unpaid.map((o) => (
            <div className="unpaid-row" key={o.id}>
              <ShoppingBag size={18} />
              <span>
                <b>
                  {o.id} · {o.customerName}
                </b>
                <small>{o.lines.map((l) => l.name).join(", ")}</small>
              </span>
              <Status status={o.status} />
              <b>{yen(o.total)}</b>
              <button
                className="button button-primary button-small"
                onClick={() => pay(o)}
              >
                Take payment
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function Team({ data, add }: { data: Dashboard; add: () => void }) {
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE & PAYROLL"
        title="Good work takes a good team."
        text="Profiles, schedules and pay records for your bakery team."
      >
        <button className="button button-primary" onClick={add}>
          <Plus size={15} /> Add team member
        </button>
      </PageHeading>
      <div className="team-metrics">
        <div>
          <span>Active team</span>
          <b>{data.employees.filter((e) => e.status === "Active").length}</b>
        </div>
        <div>
          <span>Shifts this week</span>
          <b>{data.schedules.length}</b>
        </div>
        <div>
          <span>Payroll records</span>
          <b>{data.employees.reduce((n, e) => n + e.paycheckCount, 0)}</b>
        </div>
      </div>
      <section className="panel team-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">YOUR PEOPLE</span>
            <h2>Team directory</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team member</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Since</th>
                <th>Schedules</th>
                <th>Paychecks</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((e) => (
                <tr key={e.id}>
                  <td>
                    <b>
                      {e.firstName} {e.lastName}
                    </b>
                    <small>{e.id}</small>
                  </td>
                  <td>
                    {e.email}
                    <small>{e.phone}</small>
                  </td>
                  <td>{e.role}</td>
                  <td>{dateLabel(e.hireDate)}</td>
                  <td>{e.scheduleCount} shifts</td>
                  <td>{e.paycheckCount} records</td>
                  <td>
                    <Status status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel schedule-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">ON THE FLOOR</span>
            <h2>This week’s schedule</h2>
          </div>
        </div>
        {data.schedules.map((s) => (
          <div className="schedule-row" key={s.id}>
            <CalendarDays size={17} />
            <b>{s.employeeName}</b>
            <span>
              {dateLabel(s.startDate)} — {dateLabel(s.endDate)}
            </span>
            <span>
              {s.startTime}–{s.endTime}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

function Inventory({
  data,
  role,
  save,
}: {
  data: Dashboard;
  role: Role;
  save: (id: string, q: number, min?: number) => void;
}) {
  const [values, setValues] = useState<Record<string, [string, string]>>({});
  const low = data.inventory.filter((i) => i.quantity < i.minimumQuantity);
  return (
    <>
      <PageHeading
        eyebrow="STOCKROOM"
        title="Know what’s in the pantry."
        text="Keep every batch of soufflé running smoothly."
      >
        <span
          className={`stock-status ${low.length ? "stock-warning" : "stock-good"}`}
        >
          <i />
          {low.length
            ? `${low.length} items need a restock`
            : "All stock levels healthy"}
        </span>
      </PageHeading>
      {low.length > 0 && (
        <div className="inventory-alert">
          <Activity size={17} />
          <div>
            <b>A little restock goes a long way.</b>
            <p>{low.map((i) => i.name).join(", ")} below minimum quantity.</p>
          </div>
        </div>
      )}
      <section className="panel inventory-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">INGREDIENTS & SUPPLIES</span>
            <h2>Inventory levels</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>On hand</th>
                <th>Minimum</th>
                <th>Stock status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.map((item) => {
                const [q, m] = values[item.id] ?? [
                  String(item.quantity),
                  String(item.minimumQuantity),
                ];
                const changed =
                  Number(q) !== item.quantity ||
                  Number(m) !== item.minimumQuantity;
                return (
                  <tr key={item.id}>
                    <td>
                      <b>{item.name}</b>
                      <small>{item.id}</small>
                    </td>
                    <td>
                      <label className="quantity-input">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={q}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [item.id]: [e.target.value, m],
                            })
                          }
                        />
                        <span>{item.unit}</span>
                      </label>
                    </td>
                    <td>
                      <label className="quantity-input">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          disabled={role !== "manager"}
                          value={m}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [item.id]: [q, e.target.value],
                            })
                          }
                        />
                        <span>{item.unit}</span>
                      </label>
                    </td>
                    <td>
                      <span
                        className={`stock-status ${Number(q) < Number(m) ? "stock-warning" : "stock-good"}`}
                      >
                        <i />
                        {Number(q) < Number(m)
                          ? "Reorder soon"
                          : "In good shape"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button button-outline button-small"
                        disabled={!changed}
                        onClick={() =>
                          save(
                            item.id,
                            Number(q),
                            role === "manager" ? Number(m) : undefined,
                          )
                        }
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="inventory-footnote">
          <ShieldCheck size={15} /> Low-stock alerts appear automatically below
          each minimum quantity.
        </p>
      </section>
    </>
  );
}

function Promotions({
  data,
  add,
  edit,
  act,
}: {
  data: Dashboard;
  add: () => void;
  edit: (promotion: Promotion) => void;
  act: (id: string, action: string) => void;
}) {
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE SOMETHING EXTRA"
        title="Make room for a treat."
        text="Thoughtful offers, shared with the people who love us."
      >
        <button className="button button-primary" onClick={add}>
          <Plus size={15} /> Create promotion
        </button>
      </PageHeading>
      <div className="promotion-intro">
        <Gift size={20} />
        <span>
          <b>A good offer feels personal.</b>
          <small>
            Draft an idea first, then share it. Shared promotions can be applied
            to customer orders.
          </small>
        </span>
      </div>
      <section className="promotion-grid">
        {data.promotions.map((p, i) => (
          <article className={`promotion-card promo-card-${i % 3}`} key={p.id}>
            <div className="promo-topline">
              <Status status={p.status} />
              <span>
                <button
                  className="promo-edit"
                  aria-label={`Edit ${p.title}`}
                  onClick={() => edit(p)}
                >
                  Edit
                </button>
                <button
                  className="promo-delete"
                  title="Delete promotion"
                  onClick={() => {
                    if (confirm(`Delete “${p.title}”?`)) act(p.id, "delete");
                  }}
                >
                  <X size={15} />
                </button>
              </span>
            </div>
            <div className="promo-discount">
              {p.discountType === "percent"
                ? `${p.discountValue}%`
                : yen(p.discountValue)}
              <small>OFF</small>
            </div>
            <h2>{p.title}</h2>
            <p>
              Valid {dateLabel(p.startDate)} — {dateLabel(p.endDate)}
            </p>
            <div className="promo-card-footer">
              <span>{p.sharingChannel ?? `Saved ${dateLabel(p.savedAt)}`}</span>
              {p.status === "Draft" ? (
                <button
                  className="text-link"
                  onClick={() => act(p.id, "share")}
                >
                  Share now <ArrowRight size={13} />
                </button>
              ) : (
                <button
                  className="text-link"
                  onClick={() => act(p.id, "draft")}
                >
                  Move to draft
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function Reports({
  data,
  report,
  range,
  setRange,
  run,
}: {
  data: Dashboard;
  report: ReportData | null;
  range: { from: string; to: string };
  setRange: (range: { from: string; to: string }) => void;
  run: () => void;
}) {
  const sales = report?.sales ?? data.stats;
  const low =
    report?.inventory?.belowMinimum ??
    data.inventory.filter((i) => i.quantity < i.minimumQuantity).length;
  return (
    <>
      <PageHeading
        eyebrow="THE BIGGER PICTURE"
        title="Good work, in numbers."
        text="Make confident decisions with a clear view of the business."
      >
        <button
          className="button button-outline"
          onClick={() => window.print()}
        >
          Save as PDF
        </button>
        <a
          className="button button-outline"
          href={`/api/reports?from=${range.from}&to=${range.to}&format=excel`}
        >
          Export Excel
        </a>
        <a
          className="button button-primary"
          href={`/api/reports?from=${range.from}&to=${range.to}&format=csv`}
        >
          <ArrowDownToLine size={15} /> Export CSV
        </a>
      </PageHeading>
      <section className="report-filters panel">
        <div>
          <span className="eyebrow">REPORT PERIOD</span>
          <p>Choose dates for sales and loyalty reporting.</p>
        </div>
        <label>
          From
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </label>
        <button className="button button-outline" onClick={run}>
          Run report
        </button>
      </section>
      <section className="report-metric-grid">
        <Metric
          label="Total revenue"
          value={yen(Number(sales.revenue))}
          note={`${sales.orders} completed orders`}
          icon={WalletCards}
          tint="mint"
        />
        <Metric
          label="Units sold"
          value={String(sales.unitsSold)}
          note="Across all menu items"
          icon={CakeSlice}
          tint="coral"
        />
        <Metric
          label="Average order"
          value={yen(Number(sales.averageOrder))}
          note="Per completed sale"
          icon={ReceiptText}
          tint="yellow"
        />
        <Metric
          label="Below minimum"
          value={String(low)}
          note="Current stock levels"
          icon={Package}
          tint="lilac"
        />
      </section>
      <section className="reports-grid">
        <article className="panel report-chart-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">REVENUE OVER TIME</span>
              <h2>Daily sales</h2>
            </div>
            <span>
              {dateLabel(range.from)} — {dateLabel(range.to)}
            </span>
          </div>
          <div className="chart-wrap report-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={report?.byDay ?? data.chart}
                margin={{ top: 12, right: 4, bottom: 0, left: -20 }}
              >
                <defs>
                  <linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d7654d" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#d7654d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#e9ece7"
                  vertical={false}
                  strokeDasharray="3 5"
                />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={dateLabel}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v ? `¥${Math.round(v / 1000)}k` : "¥0"
                  }
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(v) => [yen(Number(v)), "Sales"]} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#d7654d"
                  fill="url(#reportFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="panel loyalty-panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">SOUFFLÉ CLUB</span>
              <h2>Loyalty snapshot</h2>
            </div>
            <Gift size={18} />
          </div>
          <div className="loyalty-stats">
            <div>
              <span>Registered</span>
              <b>
                {report?.loyalty?.registeredCustomers ?? data.customers.length}
              </b>
              <small>customers</small>
            </div>
            <div>
              <span>Repeat purchases</span>
              <b>{report?.loyalty?.repeatPurchases ?? 0}</b>
              <small>returning guests</small>
            </div>
            <div>
              <span>Points issued</span>
              <b>{report?.loyalty?.pointsIssued ?? 0}</b>
              <small>this period</small>
            </div>
            <div>
              <span>Points redeemed</span>
              <b>{report?.loyalty?.pointsRedeemed ?? 0}</b>
              <small>this period</small>
            </div>
          </div>
        </article>
      </section>
      <section className="panel best-seller-panel">
        <div className="panel-header">
          <div>
            <span className="eyebrow">CUSTOMER FAVORITES</span>
            <h2>Best sellers</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Menu item</th>
                <th>Units sold</th>
                <th>Revenue</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {(report?.bestSellers ?? []).map(
                (item: { name: string; quantity: number; revenue: number }) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>{yen(item.revenue)}</td>
                    <td>
                      {sales.revenue
                        ? Math.round((item.revenue / sales.revenue) * 100)
                        : 0}
                      %
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="modal-dialog" role="dialog" aria-modal="true">
        {children}
      </section>
    </div>
  );
}
function ModalHeader({
  eyebrow,
  title,
  text,
  close,
}: {
  eyebrow: string;
  title: string;
  text: string;
  close: () => void;
}) {
  return (
    <div className="modal-heading">
      <div>
        <span className="eyebrow">
          <i /> {eyebrow}
        </span>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      <button
        className="icon-button"
        type="button"
        aria-label="Close"
        onClick={close}
      >
        <X size={18} />
      </button>
    </div>
  );
}
function ModalFooter({ close, label }: { close: () => void; label: string }) {
  return (
    <div className="modal-footer">
      <button type="button" className="button button-text" onClick={close}>
        Cancel
      </button>
      <button className="button button-primary">
        {label} <ArrowRight size={15} />
      </button>
    </div>
  );
}

function OrderForm({
  data,
  user,
  close,
  submit,
}: {
  data: Dashboard;
  user: User;
  close: () => void;
  submit: (body: Record<string, unknown>) => void;
}) {
  const [menuId, setMenuId] = useState(data.menuItems[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [customerName, setCustomerName] = useState(
    user.role === "customer" ? user.name : "",
  );
  const [customerEmail, setCustomerEmail] = useState(
    user.role === "customer" ? user.email : "",
  );
  const [orderType, setOrderType] = useState("Pickup");
  const [promoId, setPromoId] = useState("");
  const item = data.menuItems.find((i) => i.id === menuId);
  const subtotal = (item?.price ?? 0) * qty;
  const promo = data.promotions.find((p) => p.id === promoId);
  const discount = promo
    ? promo.discountType === "percent"
      ? Math.round((subtotal * promo.discountValue) / 100)
      : Math.min(subtotal, promo.discountValue)
    : 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          items: [{ menuItemId: menuId, quantity: qty, instructions: note }],
          orderType,
          channel: user.role === "customer" ? "Online" : "In store",
          customerName,
          customerEmail,
          promotionId: promoId || undefined,
        });
      }}
    >
      <ModalHeader
        eyebrow="MADE TO ORDER"
        title="Start something lovely."
        text="We’ll take care of the details from here."
        close={close}
      />
      <div className="modal-body">
        <label className="field-label">
          Choose your cake
          <select value={menuId} onChange={(e) => setMenuId(e.target.value)}>
            {data.menuItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {yen(i.price)}
              </option>
            ))}
          </select>
        </label>
        {item && (
          <div className="menu-choice">
            <span className="menu-choice-image" />
            <span>
              <b>{item.name}</b>
              <small>{item.description}</small>
            </span>
            <b>{yen(item.price)}</b>
          </div>
        )}
        <div className="field-row">
          <label className="field-label">
            Quantity
            <div className="stepper">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
              >
                −
              </button>
              <b>{qty}</b>
              <button
                type="button"
                onClick={() => setQty(Math.min(20, qty + 1))}
              >
                +
              </button>
            </div>
          </label>
          <label className="field-label">
            Pickup or delivery
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
            >
              <option>Pickup</option>
              <option>Delivery</option>
            </select>
          </label>
        </div>
        <label className="field-label">
          A note for the baker
          <textarea
            rows={3}
            maxLength={240}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A name, a message, a little extra care..."
          />
        </label>
        {user.role !== "customer" && (
          <div className="field-row">
            <label className="field-label">
              Customer name
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Guest customer"
              />
            </label>
            <label className="field-label">
              Customer email
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="For loyalty points"
              />
            </label>
          </div>
        )}
        {data.promotions.some((p) => p.status === "Shared") && (
          <label className="field-label">
            Apply a little extra
            <select
              value={promoId}
              onChange={(e) => setPromoId(e.target.value)}
            >
              <option value="">No promotion</option>
              {data.promotions
                .filter((p) => p.status === "Shared")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className="order-estimate">
          <span>Ready in about 90 minutes</span>
          <b>{yen(subtotal - discount)}</b>
        </div>
      </div>
      <ModalFooter close={close} label="Create order" />
    </form>
  );
}

function PaymentForm({
  data,
  order,
  close,
  submit,
}: {
  data: Dashboard;
  order?: Order;
  close: () => void;
  submit: (body: Record<string, unknown>) => void;
}) {
  const unpaid = data.orders.filter(
    (o) =>
      !["Cancelled", "Completed"].includes(o.status) &&
      !data.payments.some((p) => p.orderId === o.id),
  );
  const [orderId, setOrderId] = useState(order?.id ?? unpaid[0]?.id ?? "");
  const [method, setMethod] = useState("Card");
  const [cash, setCash] = useState("");
  const selected = data.orders.find((o) => o.id === orderId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          orderId,
          method,
          cashReceived: method === "Cash" ? Number(cash) : undefined,
        });
      }}
    >
      <ModalHeader
        eyebrow="CHECKOUT"
        title="Take a payment."
        text="A receipt is created as soon as payment succeeds."
        close={close}
      />
      <div className="modal-body">
        {!order && (
          <label className="field-label">
            Order
            <select
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              {unpaid.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} · {o.customerName} · {yen(o.total)}
                </option>
              ))}
            </select>
          </label>
        )}
        {selected && (
          <div className="payment-total">
            <span>
              {selected.id} · {selected.customerName}
            </span>
            <strong>{yen(selected.total)}</strong>
          </div>
        )}
        <label className="field-label">
          Payment method
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Card</option>
            <option>Cash</option>
          </select>
        </label>
        {method === "Cash" && (
          <label className="field-label">
            Cash received
            <input
              type="number"
              min={selected?.total ?? 1}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              required
            />
          </label>
        )}
        <p className="secure-note">
          <ShieldCheck size={15} /> Demo card authorization only. Card details
          are never collected.
        </p>
      </div>
      <ModalFooter
        close={close}
        label={`Confirm ${method.toLowerCase()} payment`}
      />
    </form>
  );
}

function PromotionForm({
  promotion,
  close,
  submit,
}: {
  promotion?: Promotion;
  close: () => void;
  submit: (body: Record<string, unknown>) => void;
}) {
  const [title, setTitle] = useState(promotion?.title ?? "");
  const [type, setType] = useState(promotion?.discountType ?? "percent");
  const [value, setValue] = useState(String(promotion?.discountValue ?? 10));
  const [start, setStart] = useState(
    promotion?.startDate.slice(0, 10) ?? defaultReportTo,
  );
  const [end, setEnd] = useState(
    promotion?.endDate.slice(0, 10) ?? defaultPromotionEnd,
  );
  const [status, setStatus] = useState(promotion?.status ?? "Draft");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          title,
          discountType: type,
          discountValue: Number(value),
          startDate: start,
          endDate: end,
          status,
        });
      }}
    >
      <ModalHeader
        eyebrow="THE GOOD STUFF"
        title={promotion ? "Polish your offer." : "Make someone’s day."}
        text="Make it thoughtful, make it yours."
        close={close}
      />
      <div className="modal-body">
        <label className="field-label">
          Promotion title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <div className="field-row">
          <label className="field-label">
            Discount type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>
          <label className="field-label">
            Value
            <input
              type="number"
              min="1"
              max={type === "percent" ? 100 : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        </div>
        <div className="field-row">
          <label className="field-label">
            Start date
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field-label">
            End date
            <input
              type="date"
              min={start}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        {!promotion && (
          <label className="field-label">
            Save as
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Draft</option>
              <option>Shared</option>
            </select>
          </label>
        )}
      </div>
      <ModalFooter
        close={close}
        label={
          promotion
            ? "Save changes"
            : status === "Draft"
              ? "Save draft"
              : "Share promotion"
        }
      />
    </form>
  );
}

function EmployeeForm({
  close,
  submit,
}: {
  close: () => void;
  submit: (body: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "employee",
    password: "",
  });
  const update = (key: keyof typeof form, value: string) =>
    setForm({ ...form, [key]: value });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(form);
      }}
    >
      <ModalHeader
        eyebrow="NEW TEAM MEMBER"
        title="Welcome them in."
        text="Create a profile and secure sign-in account."
        close={close}
      />
      <div className="modal-body">
        <div className="field-row">
          <label className="field-label">
            First name
            <input
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              required
            />
          </label>
          <label className="field-label">
            Last name
            <input
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              required
            />
          </label>
        </div>
        <label className="field-label">
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
          />
        </label>
        <label className="field-label">
          Phone
          <input
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </label>
        <div className="field-row">
          <label className="field-label">
            Role
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
            </select>
          </label>
          <label className="field-label">
            Temporary password
            <input
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              required
            />
          </label>
        </div>
      </div>
      <ModalFooter close={close} label="Create account" />
    </form>
  );
}
