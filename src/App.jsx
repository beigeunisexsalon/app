import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, CalendarDays, Receipt, Users, Package,
  Briefcase, Wallet, BarChart3, Settings as SettingsIcon,
  Plus, X, Printer, Search, TrendingUp, AlertTriangle, Scissors,
  Pencil, Trash2, FileText, CheckCircle2, Star, MessageCircle, Smartphone
} from "lucide-react";

const STORAGE_KEY = "beige-salon-data-v1";
const SESSION_KEY = "beige-salon-session-v1";

// Standalone browser storage (works on any deployed site — no backend needed).
// Note: this saves data per-device/browser. If you want every tablet, phone,
// and computer at the salon to share the SAME live data (including staff
// logins), swap this for a backend like Supabase — ask Claude when ready.
async function loadKV(key) {
  return localStorage.getItem(key);
}
async function saveKV(key, value) {
  localStorage.setItem(key, value);
}
async function deleteKV(key) {
  localStorage.removeItem(key);
}

const seed = {
  settings: {
    salonName: "Beige Unisex Salon", gst: 5, footer: "Thank you for visiting!", membershipFee: 499, upiId: "",
    credentials: {
      Admin: { username: "admin", password: "admin123" },
      Reception: { username: "reception", password: "reception123" },
      Stylist: { username: "stylist", password: "stylist123" },
    },
  },
  services: [
    { id: "s1", name: "Haircut", price: 400, duration: 30, commission: 20 },
    { id: "s2", name: "Beard", price: 150, duration: 15, commission: 15 },
    { id: "s3", name: "Hair Spa", price: 900, duration: 45, commission: 20 },
    { id: "s4", name: "Facial", price: 1200, duration: 40, commission: 25 },
    { id: "s5", name: "Waxing", price: 500, duration: 30, commission: 20 },
    { id: "s6", name: "Pedicure", price: 600, duration: 30, commission: 15 },
    { id: "s7", name: "Hair Color", price: 3500, duration: 90, commission: 25 },
  ],
  employees: [
    { id: "e1", name: "Ravi Kumar", role: "Senior Stylist", phone: "9840011122", salary: 18000, commissionPct: 20 },
    { id: "e2", name: "Meena", role: "Beautician", phone: "9840033344", salary: 15000, commissionPct: 20 },
  ],
  customers: [
    { id: "walkin", name: "Walk-in", phone: "-", birthday: "", gender: "Other", notes: "", allergies: "", membership: "", loyaltyPoints: 0, isWalkIn: true },
    { id: "c1", name: "Sneha", phone: "9876543210", birthday: "1996-07-15", gender: "Female", notes: "", allergies: "", membership: "", loyaltyPoints: 12 },
    { id: "c2", name: "Priya", phone: "9876500011", birthday: "1992-03-02", gender: "Female", notes: "", allergies: "", membership: "Member", loyaltyPoints: 40 },
  ],
  appointments: [
    { id: "a1", date: todayISO(), time: "09:00", customer: "Sneha", service: "Haircut", stylist: "Ravi Kumar", status: "pending" },
    { id: "a2", date: todayISO(), time: "10:00", customer: "Priya", service: "Hair Spa", stylist: "Meena", status: "pending" },
    { id: "a3", date: todayISO(), time: "11:30", customer: "Walk-in", service: "Haircut", stylist: "Ravi Kumar", status: "pending" },
  ],
  inventory: [
    { id: "p1", name: "Cadiveu Shampoo", stock: 15, min: 5, supplier: "Cadiveu", purchasePrice: 680, sellingPrice: 950, retail: true, linkedService: "", usagePerService: 0 },
    { id: "p2", name: "Loreal Hair Color Tube", stock: 4, min: 6, supplier: "Loreal", purchasePrice: 220, sellingPrice: 350, retail: false, linkedService: "Hair Color", usagePerService: 1 },
    { id: "p3", name: "Wax Strips (box)", stock: 2, min: 4, supplier: "Local Supplier", purchasePrice: 150, sellingPrice: 250, retail: false, linkedService: "Waxing", usagePerService: 1 },
  ],
  expenses: [],
  bills: [],
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDays(dateStr, days) { const d = new Date(dateStr); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }
function rupee(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function uid(p) { return p + Math.random().toString(36).slice(2, 9); }
function buildUpiLink(upiId, payeeName, amount, note) {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName, am: String(amount), cu: "INR", tn: note || "Salon bill" });
  return `upi://pay?${params.toString()}`;
}
function qrImageUrl(data, size = 190) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}
function formatPhoneIntl(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits || digits === "0") return "";
  if (digits.length === 10) return "91" + digits; // assume Indian mobile number
  return digits;
}
function buildReceiptText(receipt, settings) {
  const lines = [
    `${settings.salonName}`,
    `${receipt.date} — Bill for ${receipt.customer}`,
    ...receipt.items.map((i) => `${i.name} x${i.qty}: ${rupee(i.price * i.qty)}`),
    `Subtotal: ${rupee(receipt.subtotal)}`,
    receipt.discount ? `Discount: -${rupee(receipt.discount)}` : null,
    `GST: ${rupee(receipt.gst)}`,
    `TOTAL: ${rupee(receipt.total)}`,
    `Paid via ${receipt.paymentMethod}`,
    settings.footer,
  ].filter(Boolean);
  return lines.join("\n");
}

export default function App() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null); // {type, payload}
  const [receipt, setReceipt] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await loadKV(STORAGE_KEY, true);
        const parsed = raw ? JSON.parse(raw) : seed;
        if (!parsed.customers.some((c) => c.id === "walkin")) {
          parsed.customers.unshift({ id: "walkin", name: "Walk-in", phone: "-", birthday: "", gender: "Other", notes: "", allergies: "", membership: "", loyaltyPoints: 0, isWalkIn: true });
        }
        if (parsed.settings.membershipFee === undefined) parsed.settings.membershipFee = 499;
        if (parsed.settings.upiId === undefined) parsed.settings.upiId = "";
        if (!parsed.settings.credentials) parsed.settings.credentials = seed.settings.credentials;
        setData(parsed);
      } catch (e) {
        setData(seed);
      } finally {
        setLoaded(true);
      }
      try {
        const rawSession = await loadKV(SESSION_KEY, false);
        if (rawSession) setSession(JSON.parse(rawSession));
      } catch (e) {}
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    saveKV(STORAGE_KEY, JSON.stringify(data), true);
  }, [data, loaded]);

  const update = (fn) => setData((d) => { const nd = structuredClone(d); fn(nd); return nd; });

  const login = (role, username) => {
    const s = { role, username };
    setSession(s);
    saveKV(SESSION_KEY, JSON.stringify(s), false);
  };
  const logout = () => {
    setSession(null);
    deleteKV(SESSION_KEY, false);
  };

  if (!loaded || !data) {
    return <div className="app-shell"><Style /><div className="loading">Setting up the salon…</div></div>;
  }

  if (!session) {
    return <><Style /><LoginScreen data={data} onLogin={login} /></>;
  }

  const role = session.role;
  const tabsAll = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Reception", "Stylist"] },
    { id: "appointments", label: "Appointments", icon: CalendarDays, roles: ["Admin", "Reception", "Stylist"] },
    { id: "billing", label: "Billing", icon: Receipt, roles: ["Admin", "Reception"] },
    { id: "bills", label: "All Bills", icon: FileText, roles: ["Admin", "Reception"] },
    { id: "customers", label: "Customers", icon: Users, roles: ["Admin", "Reception"] },
    { id: "inventory", label: "Inventory", icon: Package, roles: ["Admin"] },
    { id: "services", label: "Services", icon: Scissors, roles: ["Admin"] },
    { id: "employees", label: "Employees", icon: Briefcase, roles: ["Admin"] },
    { id: "expenses", label: "Expenses", icon: Wallet, roles: ["Admin"] },
    { id: "reports", label: "Reports", icon: BarChart3, roles: ["Admin"] },
    { id: "settings", label: "Settings", icon: SettingsIcon, roles: ["Admin"] },
  ];
  const tabs = tabsAll.filter((t) => t.roles.includes(role));
  const activeTab = tabs.find((t) => t.id === tab) ? tab : "dashboard";

  return (
    <div className="app-shell">
      <Style />
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">{data.settings.salonName}</div>
            <div className="brand-sub">salon desk</div>
          </div>
        </div>
        <nav className="nav">
          {tabs.map((t) => (
            <button key={t.id} className={"nav-item" + (activeTab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>
              <t.icon size={17} strokeWidth={1.8} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="role-switch">
          <label>Logged in as</label>
          <div className="session-info">{session.username} · {session.role}</div>
          <button className="logout-btn" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        {activeTab === "dashboard" && <Dashboard data={data} setTab={setTab} openModal={setModal} />}
        {activeTab === "appointments" && <Appointments data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "billing" && <Billing data={data} update={update} setReceipt={setReceipt} openModal={setModal} notify={notify} />}
        {activeTab === "bills" && <AllBills data={data} update={update} role={role} notify={notify} />}
        {activeTab === "customers" && <Customers data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "inventory" && <Inventory data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "services" && <Services data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "employees" && <Employees data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "expenses" && <Expenses data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "reports" && <Reports data={data} />}
        {activeTab === "settings" && <SettingsTab data={data} update={update} />}
      </main>

      {modal?.type === "customer" && (
        <CustomerModal
          initial={modal.payload}
          membershipFee={data.settings.membershipFee}
          onClose={() => setModal(null)}
          onSave={(c) => {
            update((d) => {
              if (modal.payload) {
                const idx = d.customers.findIndex((x) => x.id === modal.payload.id);
                if (idx > -1) d.customers[idx] = { ...d.customers[idx], ...c };
              } else {
                d.customers.push({ ...c, id: uid("c") });
              }
            });
            notify(modal.payload ? "Customer updated" : "Customer added");
            setModal(null);
          }}
        />
      )}
      {modal?.type === "appointment" && (
        <AppointmentModal
          data={data}
          onClose={() => setModal(null)}
          onSave={(a) => {
            update((d) => d.appointments.push({ ...a, id: uid("a"), status: "pending" }));
            notify("Appointment added");
            setModal(null);
          }}
        />
      )}
      {modal?.type === "expense" && (
        <ExpenseModal
          onClose={() => setModal(null)}
          onSave={(e) => {
            update((d) => d.expenses.push({ ...e, id: uid("x") }));
            notify("Expense added");
            setModal(null);
          }}
        />
      )}
      {modal?.type === "product" && (
        <ProductModal
          initial={modal.payload}
          services={data.services}
          onClose={() => setModal(null)}
          onSave={(p) => {
            update((d) => {
              if (modal.payload) {
                const idx = d.inventory.findIndex((x) => x.id === modal.payload.id);
                if (idx > -1) d.inventory[idx] = { ...d.inventory[idx], ...p };
              } else {
                d.inventory.push({ ...p, id: uid("p") });
              }
            });
            notify(modal.payload ? "Product updated" : "Product added");
            setModal(null);
          }}
        />
      )}
      {modal?.type === "employee" && (
        <EmployeeModal
          initial={modal.payload}
          onClose={() => setModal(null)}
          onSave={(e) => {
            update((d) => {
              if (modal.payload) {
                const idx = d.employees.findIndex((x) => x.id === modal.payload.id);
                if (idx > -1) d.employees[idx] = { ...d.employees[idx], ...e };
              } else {
                d.employees.push({ ...e, id: uid("e") });
              }
            });
            notify(modal.payload ? "Employee updated" : "Employee added");
            setModal(null);
          }}
        />
      )}
      {modal?.type === "service" && (
        <ServiceModal
          initial={modal.payload}
          onClose={() => setModal(null)}
          onSave={(s) => {
            update((d) => {
              if (modal.payload) {
                const idx = d.services.findIndex((x) => x.id === modal.payload.id);
                if (idx > -1) d.services[idx] = { ...d.services[idx], ...s };
              } else {
                d.services.push({ ...s, id: uid("s") });
              }
            });
            notify(modal.payload ? "Service updated" : "Service added");
            setModal(null);
          }}
        />
      )}
      {receipt && <ReceiptModal receipt={receipt} settings={data.settings} onClose={() => setReceipt(null)} notify={notify} />}
      {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
    </div>
  );
}

/* ---------------- Login ---------------- */
function LoginScreen({ data, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const creds = data.settings.credentials || {};
    const match = Object.entries(creds).find(
      ([, c]) => c.username.trim().toLowerCase() === username.trim().toLowerCase() && c.password === password
    );
    if (match) {
      setError("");
      onLogin(match[0], match[1].username);
    } else {
      setError("Incorrect username or password.");
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark login-mark">B</div>
        <h2>{data.settings.salonName}</h2>
        <p className="login-sub">Sign in to the salon desk</p>
        <label className="field-label">Username</label>
        <input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. reception" />
        <label className="field-label">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="btn-primary full" disabled={!username || !password}>Log in</button>
        <p className="login-hint">Ask your Admin for your username and password. Admins can view or change every role's login under Settings → Staff Logins.</p>
      </form>
    </div>
  );
}


function Dashboard({ data, setTab, openModal }) {
  const today = todayISO();
  const todaysBills = data.bills.filter((b) => b.date === today);
  const sales = todaysBills.reduce((s, b) => s + b.total, 0);
  const apptsToday = data.appointments.filter((a) => a.date === today);
  const walkins = apptsToday.filter((a) => a.customer === "Walk-in").length;
  const lowStock = data.inventory.filter((p) => p.stock <= p.min).length;
  const recent = [...data.bills].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 6);

  return (
    <div>
      <PageHead title="Dashboard" sub={new Date().toDateString()} />
      <div className="stat-grid">
        <StatCard label="Today's Sales" value={rupee(sales)} tone="ink" />
        <StatCard label="Appointments Today" value={apptsToday.length} tone="brass" />
        <StatCard label="Walk-ins" value={walkins} tone="sage" />
        <StatCard label="Products Low Stock" value={lowStock} tone={lowStock ? "brick" : "sage"} />
      </div>
      <div className="quick-actions">
        <button className="qa" onClick={() => openModal({ type: "appointment" })}><Plus size={15} />New Appointment</button>
        <button className="qa" onClick={() => setTab("billing")}><Plus size={15} />New Bill</button>
        <button className="qa" onClick={() => openModal({ type: "customer" })}><Plus size={15} />New Customer</button>
        <button className="qa" onClick={() => openModal({ type: "expense" })}><Plus size={15} />Expenses</button>
      </div>
      <SectionCard title="Recent Transactions">
        {recent.length === 0 ? <Empty text="No bills yet — generate one from Billing." /> : (
          <table className="tbl">
            <thead><tr><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th></tr></thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id}>
                  <td>{b.date}</td><td>{b.customer}</td>
                  <td>{b.items.map((i) => i.name).join(", ")}</td>
                  <td>{b.paymentMethod}</td><td>{rupee(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  return (
    <div className={"stat-card tone-" + tone}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/* ---------------- Appointments ---------------- */
function Appointments({ data, update, openModal, notify }) {
  const [filterDate, setFilterDate] = useState(""); // "" = show all upcoming/booked dates
  const [filterStylist, setFilterStylist] = useState("");
  const list = data.appointments
    .filter((a) => (filterDate ? a.date === filterDate : true))
    .filter((a) => (filterStylist ? a.stylist === filterStylist : true))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const toggleStatus = (id) => update((d) => {
    const a = d.appointments.find((x) => x.id === id);
    a.status = a.status === "done" ? "pending" : "done";
  });
  const remove = (id) => {
    if (!window.confirm("Delete this appointment?")) return;
    update((d) => { d.appointments = d.appointments.filter((x) => x.id !== id); });
    notify("Appointment deleted");
  };

  return (
    <div>
      <PageHead title="Appointments" sub="Every booking, today and upcoming" action={
        <button className="btn-primary" onClick={() => openModal({ type: "appointment" })}><Plus size={15} />New Appointment</button>
      } />
      <div className="filter-row">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} title="Filter by date" />
        {filterDate && <button className="btn-ghost" onClick={() => setFilterDate("")}>Clear date</button>}
        <select value={filterStylist} onChange={(e) => setFilterStylist(e.target.value)}>
          <option value="">All stylists</option>
          {data.employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
      </div>
      <div className="appt-list">
        {list.length === 0 ? <Empty text="No appointments match these filters yet." /> : list.map((a) => (
          <div key={a.id} className={"appt-row" + (a.status === "done" ? " done" : "")}>
            <div className="appt-time">{a.time}</div>
            <div className="appt-body">
              <div className="appt-cust">{a.customer}</div>
              <div className="appt-meta">{a.date} · {a.service} · {a.stylist}</div>
            </div>
            <button className="btn-ghost" onClick={() => toggleStatus(a.id)}>{a.status === "done" ? "Done" : "Mark done"}</button>
            <button className="btn-ghost danger" onClick={() => remove(a.id)}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Billing ---------------- */
function Billing({ data, update, setReceipt, openModal, notify }) {
  const [customerId, setCustomerId] = useState(data.customers.find((c) => c.id === "walkin")?.id || data.customers[0]?.id || "");
  const [selected, setSelected] = useState({}); // serviceId -> qty
  const [products, setProducts] = useState({}); // productId -> qty
  const [addMembership, setAddMembership] = useState(false);
  const [staff, setStaff] = useState(data.employees[0]?.name || "");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState("Cash");
  const [stockWarning, setStockWarning] = useState("");

  const customer = data.customers.find((c) => c.id === customerId);
  const retailProducts = data.inventory.filter((p) => p.retail !== false);
  const fee = data.settings.membershipFee || 0;

  const serviceItems = data.services.filter((s) => selected[s.id] > 0)
    .map((s) => ({ type: "service", name: s.name, price: s.price, qty: selected[s.id] }));
  const productItems = retailProducts.filter((p) => products[p.id] > 0)
    .map((p) => ({ type: "product", name: p.name, price: p.sellingPrice, qty: products[p.id] }));
  const membershipItem = addMembership ? [{ type: "membership", name: "Membership (1 yr)", price: fee, qty: 1 }] : [];
  const items = [...serviceItems, ...productItems, ...membershipItem];

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const gstAmt = Math.round(((subtotal - discount) * (data.settings.gst || 0)) / 100);
  const total = Math.max(0, subtotal - discount) + gstAmt;

  const toggleService = (id) => setSelected((s) => ({ ...s, [id]: s[id] ? 0 : 1 }));
  const setProductQty = (id, qty, max) => {
    const capped = Math.max(0, Math.min(qty, max));
    setProducts((p) => ({ ...p, [id]: capped }));
    setStockWarning(qty > max ? "Quantity capped at available stock." : "");
  };

  const generate = () => {
    if (items.length === 0 || !customer) return;
    const bill = {
      id: uid("b"), date: todayISO(), customer: customer.name, customerPhone: customer.phone,
      items, discount: Number(discount) || 0, gst: gstAmt, subtotal, total,
      paymentMethod: payment, staff,
    };
    update((d) => {
      d.bills.push(bill);
      const cust = d.customers.find((c) => c.id === customerId);
      if (cust) {
        const earned = Math.floor(total / 100);
        cust.loyaltyPoints = (cust.loyaltyPoints || 0) + earned;
        if (addMembership) {
          cust.membership = "Member";
          cust.membershipSince = todayISO();
          cust.membershipExpiry = addDays(todayISO(), 365);
        }
      }
      // Decrement retail products sold directly
      productItems.forEach((pi) => {
        const inv = d.inventory.find((x) => x.name === pi.name);
        if (inv) inv.stock = Math.max(0, inv.stock - pi.qty);
      });
      // Auto-deplete salon-use products linked to the services performed
      serviceItems.forEach((si) => {
        d.inventory.filter((inv) => inv.linkedService === si.name && inv.usagePerService > 0)
          .forEach((inv) => { inv.stock = Math.max(0, inv.stock - inv.usagePerService * si.qty); });
      });
    });
    setReceipt(bill);
    setSelected({}); setProducts({}); setDiscount(0); setAddMembership(false);
  };

  return (
    <div>
      <PageHead title="Billing" sub="Create a new bill" />
      <div className="billing-grid">
        <div className="billing-left">
          <label className="field-label">Customer <span className="req">*</span></label>
          <div className="row-2" style={{ gridTemplateColumns: "1fr auto" }}>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              {data.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.id === "walkin" ? "" : c.phone ? ` — ${c.phone}` : ""}</option>)}
            </select>
            <button type="button" className="btn-ghost" onClick={() => openModal({ type: "customer" })}><Plus size={13} />New</button>
          </div>

          <label className="field-label" style={{ marginTop: 12 }}>Choose services</label>
          <div className="service-check-grid">
            {data.services.map((s) => (
              <label key={s.id} className={"service-check" + (selected[s.id] ? " on" : "")}>
                <input type="checkbox" checked={!!selected[s.id]} onChange={() => toggleService(s.id)} />
                <span>{s.name}</span><span className="sc-price">{rupee(s.price)}</span>
              </label>
            ))}
          </div>

          <label className="field-label">Retail products</label>
          {retailProducts.length === 0 ? <div className="bs-empty" style={{ marginBottom: 12 }}>No retail products in inventory yet.</div> : (
            <div className="product-check-grid">
              {retailProducts.map((p) => (
                <div key={p.id} className={"product-check" + (p.stock <= 0 ? " oos" : "")}>
                  <div>
                    <div className="pc-name">{p.name}</div>
                    <div className="pc-meta">{rupee(p.sellingPrice)} · {p.stock} in stock</div>
                  </div>
                  <input type="number" min="0" max={p.stock} disabled={p.stock <= 0}
                    value={products[p.id] || 0}
                    onChange={(e) => setProductQty(p.id, Number(e.target.value), p.stock)} />
                </div>
              ))}
            </div>
          )}
          {stockWarning && <div className="stock-warning">{stockWarning}</div>}

          <label className={"membership-toggle" + (addMembership ? " on" : "")}>
            <input type="checkbox" checked={addMembership} onChange={(e) => setAddMembership(e.target.checked)} />
            <Star size={14} />
            <span>Add / renew membership for {customer?.name || "this customer"} — {rupee(fee)}/year</span>
          </label>

          <label className="field-label" style={{ marginTop: 12 }}>Staff <span className="req">*</span></label>
          <select value={staff} onChange={(e) => setStaff(e.target.value)}>
            {data.employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>

          <div className="row-2">
            <div>
              <label className="field-label">Discount (₹)</label>
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Payment method</label>
              <select value={payment} onChange={(e) => setPayment(e.target.value)}>
                <option>Cash</option><option>UPI</option><option>Card</option>
              </select>
            </div>
          </div>
        </div>

        <div className="billing-right">
          <div className="bill-summary">
            <div className="bs-title">Summary</div>
            {items.length === 0 ? <div className="bs-empty">Nothing selected yet</div> :
              items.map((i, idx) => <div key={idx} className="bs-line"><span>{i.name}{i.qty > 1 ? ` ×${i.qty}` : ""}</span><span>{rupee(i.price * i.qty)}</span></div>)}
            <div className="bs-line"><span>Subtotal</span><span>{rupee(subtotal)}</span></div>
            <div className="bs-line"><span>Discount</span><span>-{rupee(discount)}</span></div>
            <div className="bs-line"><span>GST ({data.settings.gst}%)</span><span>{rupee(gstAmt)}</span></div>
            <div className="bs-total"><span>Total</span><span>{rupee(total)}</span></div>
            <button className="btn-primary full" disabled={items.length === 0 || !customer} onClick={generate}>Generate Bill</button>
          </div>

          {payment === "UPI" && total > 0 && (
            <div className="qr-card">
              {data.settings.upiId ? (
                <>
                  <div className="bs-title">Scan to pay</div>
                  <img className="qr-img" src={qrImageUrl(buildUpiLink(data.settings.upiId, data.settings.salonName, total, `Bill for ${customer?.name || "customer"}`))} alt="UPI payment QR code" />
                  <div className="qr-fallback">{data.settings.upiId} · {rupee(total)}</div>
                  <div className="qr-note">Show this to the customer to scan and pay, then tap Generate Bill.</div>
                </>
              ) : (
                <div className="qr-note">Add your salon's UPI ID in Settings to generate payment QR codes.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({ receipt, settings, onClose, notify }) {
  const phoneDigits = formatPhoneIntl(receipt.customerPhone);
  const canSend = phoneDigits.length >= 11; // country code + 10-digit number
  const message = buildReceiptText(receipt, settings);
  const waLink = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
  const smsLink = `sms:+${phoneDigits}?body=${encodeURIComponent(message)}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal receipt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>
        <div className="receipt" id="print-area">
          <div className="receipt-brand">{settings.salonName}</div>
          <div className="receipt-sub">{receipt.date} · {receipt.customer}</div>
          <hr />
          {receipt.items.map((i, idx) => (
            <div key={idx} className="receipt-line"><span>{i.name} x{i.qty}</span><span>{rupee(i.price * i.qty)}</span></div>
          ))}
          <hr />
          <div className="receipt-line"><span>Subtotal</span><span>{rupee(receipt.subtotal)}</span></div>
          <div className="receipt-line"><span>Discount</span><span>-{rupee(receipt.discount)}</span></div>
          <div className="receipt-line"><span>GST</span><span>{rupee(receipt.gst)}</span></div>
          <div className="receipt-total"><span>TOTAL</span><span>{rupee(receipt.total)}</span></div>
          <div className="receipt-sub">Paid via {receipt.paymentMethod}</div>
          {receipt.paymentMethod === "UPI" && settings.upiId && (
            <div className="qr-card" style={{ border: "none", boxShadow: "none", padding: "10px 0 0" }}>
              <img className="qr-img" src={qrImageUrl(buildUpiLink(settings.upiId, settings.salonName, receipt.total, `Bill for ${receipt.customer}`))} alt="UPI payment QR code" />
              <div className="qr-fallback">{settings.upiId} · {rupee(receipt.total)}</div>
            </div>
          )}
          <div className="receipt-footer">{settings.footer}</div>
        </div>
        <button className="btn-primary full" onClick={() => { window.print(); notify && notify("Receipt generated & sent to printer"); }}><Printer size={15} />Print</button>
        {canSend ? (
          <div className="send-row">
            <a className="btn-ghost send-btn" href={waLink} target="_blank" rel="noopener noreferrer" onClick={() => notify && notify("Opening WhatsApp to send the bill")}>
              <MessageCircle size={14} />WhatsApp
            </a>
            <a className="btn-ghost send-btn" href={smsLink} onClick={() => notify && notify("Opening Messages to send the bill")}>
              <Smartphone size={14} />SMS
            </a>
          </div>
        ) : (
          <div className="qr-note" style={{ marginTop: 8 }}>No valid phone number on file — add one to this customer's profile to send bills directly.</div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Customers ---------------- */
function Customers({ data, update, openModal, notify }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const list = data.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  const remove = (c) => {
    if (c.id === "walkin") return;
    if (!window.confirm(`Delete ${c.name}'s profile? This can't be undone.`)) return;
    update((d) => { d.customers = d.customers.filter((x) => x.id !== c.id); });
    notify("Customer deleted");
  };

  return (
    <div>
      <PageHead title="Customers" sub={`${data.customers.length} profiles`} action={
        <button className="btn-primary" onClick={() => openModal({ type: "customer" })}><Plus size={15} />New Customer</button>
      } />
      <div className="search-row"><Search size={15} /><input placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="cust-grid">
        {list.map((c) => (
          <div key={c.id} className="cust-card">
            <div className="cust-top" onClick={() => setOpen(open === c.id ? null : c.id)} style={{ cursor: "pointer" }}>
              <div className="cust-name">{c.name} {c.membership && <span className="badge">{c.membership}</span>}</div>
              <div className="cust-phone">{c.phone}</div>
            </div>
            <div className="cust-meta" onClick={() => setOpen(open === c.id ? null : c.id)} style={{ cursor: "pointer" }}>{c.loyaltyPoints || 0} pts · {c.gender}</div>
            <div className="cust-actions">
              <button className="btn-ghost" onClick={() => openModal({ type: "customer", payload: c })}><Pencil size={12} />Edit</button>
              {c.id !== "walkin" && <button className="btn-ghost danger" onClick={() => remove(c)}><Trash2 size={12} />Delete</button>}
            </div>
            {open === c.id && (
              <div className="cust-detail">
                {c.allergies && <div className="detail-row"><b>Allergies:</b> {c.allergies}</div>}
                {c.notes && <div className="detail-row"><b>Notes:</b> {c.notes}</div>}
                <div className="detail-row"><b>Birthday:</b> {c.birthday || "—"}</div>
                {c.membership && <div className="detail-row"><b>Membership:</b> {c.membership} {c.membershipExpiry ? `(renews ${c.membershipExpiry})` : ""}</div>}
                <div className="visit-title">Visit history</div>
                {data.bills.filter((b) => b.customer === c.name).length === 0 ? <div className="bs-empty">No visits yet</div> :
                  data.bills.filter((b) => b.customer === c.name).map((b) => (
                    <div key={b.id} className="visit-row"><span>{b.date}</span><span>{b.items.map((i) => i.name).join(", ")}</span><span>{rupee(b.total)}</span></div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Inventory ---------------- */
function Inventory({ data, update, openModal, notify }) {
  const adjust = (id, delta) => update((d) => {
    const p = d.inventory.find((x) => x.id === id);
    p.stock = Math.max(0, p.stock + delta);
  });
  const remove = (p) => {
    if (!window.confirm(`Delete "${p.name}" from inventory?`)) return;
    update((d) => { d.inventory = d.inventory.filter((x) => x.id !== p.id); });
    notify("Product deleted");
  };
  return (
    <div>
      <PageHead title="Inventory" sub="Retail & salon-use products" action={
        <button className="btn-primary" onClick={() => openModal({ type: "product" })}><Plus size={15} />New Product</button>
      } />
      <table className="tbl">
        <thead><tr><th>Product</th><th>Type</th><th>Supplier</th><th>Stock</th><th>Min</th><th>Purchase</th><th>Selling</th><th>Status</th><th></th><th></th></tr></thead>
        <tbody>
          {data.inventory.map((p) => (
            <tr key={p.id} className={p.stock <= p.min ? "low" : ""}>
              <td>{p.name}</td>
              <td>{p.retail !== false ? "Retail" : (p.linkedService ? `Auto: -${p.usagePerService}/${p.linkedService}` : "Salon-use")}</td>
              <td>{p.supplier}</td><td>{p.stock}</td><td>{p.min}</td>
              <td>{rupee(p.purchasePrice)}</td><td>{rupee(p.sellingPrice)}</td>
              <td>{p.stock <= p.min ? <span className="tag brick"><AlertTriangle size={12} />Low stock</span> : <span className="tag sage">OK</span>}</td>
              <td className="stock-btns"><button onClick={() => adjust(p.id, -1)}>−</button><button onClick={() => adjust(p.id, 1)}>+</button></td>
              <td className="row-actions">
                <button className="btn-ghost" onClick={() => openModal({ type: "product", payload: p })}><Pencil size={12} /></button>
                <button className="btn-ghost danger" onClick={() => remove(p)}><Trash2 size={12} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="empty" style={{ marginTop: 10 }}>Retail products can be sold directly on a bill and their stock drops automatically. Salon-use products (marked "Auto") deplete on their own whenever the linked service is billed — set this up when adding a product.</div>
    </div>
  );
}

/* ---------------- Services ---------------- */
function Services({ data, update, openModal, notify }) {
  const editPrice = (id, field, val) => update((d) => { d.services.find((s) => s.id === id)[field] = Number(val); });
  const remove = (s) => {
    if (!window.confirm(`Delete "${s.name}" from the service menu?`)) return;
    update((d) => { d.services = d.services.filter((x) => x.id !== s.id); });
    notify("Service deleted");
  };
  return (
    <div>
      <PageHead title="Services" sub="Menu, pricing & commission" action={
        <button className="btn-primary" onClick={() => openModal({ type: "service" })}><Plus size={15} />New Service</button>
      } />
      <table className="tbl">
        <thead><tr><th>Service</th><th>Price</th><th>Duration (min)</th><th>Commission %</th><th></th></tr></thead>
        <tbody>
          {data.services.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td><input className="cell-input" type="number" value={s.price} onChange={(e) => editPrice(s.id, "price", e.target.value)} /></td>
              <td><input className="cell-input" type="number" value={s.duration} onChange={(e) => editPrice(s.id, "duration", e.target.value)} /></td>
              <td><input className="cell-input" type="number" value={s.commission} onChange={(e) => editPrice(s.id, "commission", e.target.value)} /></td>
              <td><button className="btn-ghost danger" onClick={() => remove(s)}><Trash2 size={12} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Employees ---------------- */
function Employees({ data, update, openModal, notify }) {
  const commissionFor = (emp) => data.bills.filter((b) => b.staff === emp.name)
    .reduce((sum, b) => sum + Math.round(b.total * (emp.commissionPct / 100)), 0);
  const revenueFor = (emp) => data.bills.filter((b) => b.staff === emp.name).reduce((s, b) => s + b.total, 0);
  const clientsFor = (emp) => new Set(data.bills.filter((b) => b.staff === emp.name).map((b) => b.customer)).size;
  const remove = (e) => {
    if (!window.confirm(`Remove ${e.name} from the team?`)) return;
    update((d) => { d.employees = d.employees.filter((x) => x.id !== e.id); });
    notify("Employee removed");
  };

  return (
    <div>
      <PageHead title="Employees" sub="Team & commission" action={
        <button className="btn-primary" onClick={() => openModal({ type: "employee" })}><Plus size={15} />New Employee</button>
      } />
      <div className="emp-grid">
        {data.employees.map((e) => (
          <div key={e.id} className="emp-card">
            <div className="cust-top">
              <div className="emp-name">{e.name}</div>
              <div className="cust-actions">
                <button className="btn-ghost" onClick={() => openModal({ type: "employee", payload: e })}><Pencil size={12} />Edit</button>
                <button className="btn-ghost danger" onClick={() => remove(e)}><Trash2 size={12} />Delete</button>
              </div>
            </div>
            <div className="emp-role">{e.role} · {e.phone}</div>
            <div className="emp-stats">
              <div><span>{rupee(e.salary)}</span><label>Salary</label></div>
              <div><span>{e.commissionPct}%</span><label>Commission</label></div>
              <div><span>{rupee(revenueFor(e))}</span><label>Revenue</label></div>
              <div><span>{rupee(commissionFor(e))}</span><label>Earned</label></div>
              <div><span>{clientsFor(e)}</span><label>Clients</label></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Expenses ---------------- */
function Expenses({ data, openModal }) {
  const month = todayISO().slice(0, 7);
  const monthTotal = data.expenses.filter((e) => e.date.slice(0, 7) === month).reduce((s, e) => s + Number(e.amount), 0);
  return (
    <div>
      <PageHead title="Expenses" sub={`This month: ${rupee(monthTotal)}`} action={
        <button className="btn-primary" onClick={() => openModal({ type: "expense" })}><Plus size={15} />New Expense</button>
      } />
      <table className="tbl">
        <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th></tr></thead>
        <tbody>
          {[...data.expenses].reverse().map((e) => (
            <tr key={e.id}><td>{e.date}</td><td>{e.category}</td><td>{e.note}</td><td>{rupee(e.amount)}</td></tr>
          ))}
          {data.expenses.length === 0 && <tr><td colSpan="4"><Empty text="No expenses logged yet." /></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- All Bills ---------------- */
function AllBills({ data, update, role, notify }) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = [...data.bills]
    .filter((b) => (q ? b.customer.toLowerCase().includes(q.toLowerCase()) : true))
    .filter((b) => (from ? b.date >= from : true))
    .filter((b) => (to ? b.date <= to : true))
    .sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  const totalShown = list.reduce((s, b) => s + b.total, 0);

  const remove = (b) => {
    if (!window.confirm(`Delete this bill for ${b.customer} (${rupee(b.total)})? Stock already deducted will not be restored.`)) return;
    update((d) => { d.bills = d.bills.filter((x) => x.id !== b.id); });
    notify("Bill deleted");
  };

  return (
    <div>
      <PageHead title="All Bills" sub={`${list.length} bills · ${rupee(totalShown)} shown`} />
      <div className="filter-row">
        <input placeholder="Search by customer" value={q} onChange={(e) => setQ(e.target.value)} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        {(q || from || to) && <button className="btn-ghost" onClick={() => { setQ(""); setFrom(""); setTo(""); }}>Clear</button>}
      </div>
      <table className="tbl">
        <thead><tr><th>Date</th><th>Customer</th><th>Staff</th><th>Items</th><th>Payment</th><th>Total</th>{role === "Admin" && <th></th>}</tr></thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.id}>
              <td>{b.date}</td><td>{b.customer}</td><td>{b.staff}</td>
              <td>{b.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</td>
              <td>{b.paymentMethod}</td><td>{rupee(b.total)}</td>
              {role === "Admin" && <td><button className="btn-ghost danger" onClick={() => remove(b)}><Trash2 size={12} /></button></td>}
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan="7"><Empty text="No bills match these filters." /></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Reports ---------------- */
function Reports({ data }) {
  const month = todayISO().slice(0, 7);
  const monthBills = data.bills.filter((b) => b.date.slice(0, 7) === month);
  const monthSales = monthBills.reduce((s, b) => s + b.total, 0);
  const monthExpenses = data.expenses.filter((e) => e.date.slice(0, 7) === month).reduce((s, e) => s + Number(e.amount), 0);
  const profit = monthSales - monthExpenses;

  const serviceAgg = {};
  const productAgg = {};
  monthBills.forEach((b) => b.items.forEach((i) => {
    const bucket = i.type === "product" ? productAgg : serviceAgg;
    bucket[i.name] = (bucket[i.name] || 0) + i.price * i.qty;
  }));
  const topServices = Object.entries(serviceAgg).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topProducts = Object.entries(productAgg).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const staffAgg = {};
  monthBills.forEach((b) => { staffAgg[b.staff] = (staffAgg[b.staff] || 0) + b.total; });
  const topStaff = Object.entries(staffAgg).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const payAgg = { Cash: 0, UPI: 0, Card: 0 };
  monthBills.forEach((b) => { payAgg[b.paymentMethod] = (payAgg[b.paymentMethod] || 0) + b.total; });

  return (
    <div>
      <PageHead title="Reports" sub={`Month of ${month}`} />
      <div className="stat-grid">
        <StatCard label="Month Sales" value={rupee(monthSales)} tone="ink" />
        <StatCard label="Month Expenses" value={rupee(monthExpenses)} tone="brick" />
        <StatCard label="Profit" value={rupee(profit)} tone={profit >= 0 ? "sage" : "brick"} />
        <StatCard label="Bills this month" value={monthBills.length} tone="brass" />
      </div>
      <div className="reports-grid">
        <SectionCard title="Top Services">
          {topServices.length === 0 ? <Empty text="No sales this month yet." /> : topServices.map(([name, val]) => <Bar key={name} label={name} value={val} max={topServices[0][1]} />)}
        </SectionCard>
        <SectionCard title="Top Retail Products">
          {topProducts.length === 0 ? <Empty text="No retail sales this month yet." /> : topProducts.map(([name, val]) => <Bar key={name} label={name} value={val} max={topProducts[0][1]} />)}
        </SectionCard>
        <SectionCard title="Top Employees">
          {topStaff.length === 0 ? <Empty text="No sales this month yet." /> : topStaff.map(([name, val]) => <Bar key={name} label={name} value={val} max={topStaff[0][1]} />)}
        </SectionCard>
        <SectionCard title="Payment Breakdown">
          {Object.entries(payAgg).map(([name, val]) => <Bar key={name} label={name} value={val} max={Math.max(1, ...Object.values(payAgg))} />)}
        </SectionCard>
      </div>
    </div>
  );
}

function Bar({ label, value, max }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track"><div className="bar-fill" style={{ width: pct + "%" }} /></div>
      <div className="bar-value">{rupee(value)}</div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab({ data, update }) {
  const s = data.settings;
  const set = (field, val) => update((d) => { d.settings[field] = val; });
  return (
    <div>
      <PageHead title="Settings" sub="Salon profile & receipt" />
      <SectionCard title="Salon profile">
        <label className="field-label">Salon name</label>
        <input value={s.salonName} onChange={(e) => set("salonName", e.target.value)} />
        <label className="field-label">GST %</label>
        <input type="number" value={s.gst} onChange={(e) => set("gst", Number(e.target.value))} />
        <label className="field-label">Receipt footer</label>
        <input value={s.footer} onChange={(e) => set("footer", e.target.value)} />
        <label className="field-label">Membership fee (₹ / year)</label>
        <input type="number" value={s.membershipFee} onChange={(e) => set("membershipFee", Number(e.target.value))} />
        <label className="field-label">UPI ID (for payment QR codes)</label>
        <input placeholder="e.g. yoursalon@okhdfcbank" value={s.upiId} onChange={(e) => set("upiId", e.target.value)} />
      </SectionCard>

      <SectionCard title="Staff Logins">
        <div className="empty" style={{ marginBottom: 12 }}>Set the username and password each role uses to sign in. Share these with the relevant staff — anyone signing in with these credentials gets that role's access.</div>
        {["Admin", "Reception", "Stylist"].map((r) => (
          <div key={r} className="login-row">
            <div className="login-row-label">{r}</div>
            <input placeholder="Username" value={s.credentials[r].username}
              onChange={(e) => update((d) => { d.settings.credentials[r].username = e.target.value; })} />
            <input placeholder="Password" value={s.credentials[r].password}
              onChange={(e) => update((d) => { d.settings.credentials[r].password = e.target.value; })} />
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

/* ---------------- Shared bits ---------------- */
function PageHead({ title, sub, action }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1><p>{sub}</p></div>
      {action}
    </div>
  );
}
function SectionCard({ title, children }) {
  return <div className="section-card"><div className="section-title">{title}</div>{children}</div>;
}
function Empty({ text }) { return <div className="empty">{text}</div>; }

function ModalShell({ title, onClose, children, onSave, saveLabel = "Save", disabled, hint }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">{children}</div>
        {hint && <div className="modal-hint">{hint}</div>}
        <button className="btn-primary full" onClick={onSave} disabled={disabled}>{saveLabel}</button>
      </div>
    </div>
  );
}

function CustomerModal({ onClose, onSave, initial, membershipFee }) {
  const [f, setF] = useState(initial ? { ...initial } : { name: "", phone: "", birthday: "", gender: "", notes: "", allergies: "", membership: "", loyaltyPoints: 0 });
  const isValid = f.name.trim().length > 0 && f.phone.trim().length >= 4 && f.gender;
  return (
    <ModalShell
      title={initial ? "Edit Customer" : "New Customer"}
      onClose={onClose}
      onSave={() => isValid && onSave(f)}
      disabled={!isValid}
      hint="Name, mobile number and gender are required."
    >
      <label className="field-label">Name <span className="req">*</span></label>
      <input placeholder="e.g. Priya Menon" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />

      <label className="field-label">Mobile number <span className="req">*</span></label>
      <input placeholder="e.g. 9876543210" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />

      <label className="field-label">Gender <span className="req">*</span></label>
      <select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
        <option value="">Select gender…</option>
        <option>Female</option><option>Male</option><option>Other</option>
      </select>

      <label className="field-label">Birthday (optional)</label>
      <input type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} />

      <label className="field-label">Allergies (optional)</label>
      <input placeholder="e.g. Ammonia-based hair color" value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} />

      <label className="field-label">Notes (optional)</label>
      <textarea placeholder="Anything staff should know about this customer" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />

      <label className={"membership-toggle" + (f.membership === "Member" ? " on" : "")}>
        <input type="checkbox" checked={f.membership === "Member"} onChange={(e) => setF({ ...f, membership: e.target.checked ? "Member" : "" })} />
        <Star size={14} />
        <span>Enrolled as Member ({rupee(membershipFee || 499)}/year)</span>
      </label>
    </ModalShell>
  );
}

function AppointmentModal({ data, onClose, onSave }) {
  const [f, setF] = useState({
    date: todayISO(), time: "09:00",
    customer: data.customers.find((c) => c.id === "walkin")?.name || data.customers[0]?.name || "",
    service: data.services[0]?.name || "", stylist: data.employees[0]?.name || "",
  });
  const noServices = data.services.length === 0;
  const noStaff = data.employees.length === 0;
  const isValid = f.date && f.time && f.customer && f.service && f.stylist;
  return (
    <ModalShell
      title="New Appointment"
      onClose={onClose}
      onSave={() => isValid && onSave(f)}
      disabled={!isValid}
      hint={noServices ? "Add a service first (Services tab)." : noStaff ? "Add an employee first (Employees tab)." : "Date, time, customer, service and stylist are all required."}
    >
      <label className="field-label">Date <span className="req">*</span></label>
      <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />

      <label className="field-label">Time <span className="req">*</span></label>
      <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />

      <label className="field-label">Customer <span className="req">*</span></label>
      <select value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })}>
        {data.customers.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
      </select>

      <label className="field-label">Service <span className="req">*</span></label>
      <select value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })} disabled={noServices}>
        {data.services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>

      <label className="field-label">Stylist <span className="req">*</span></label>
      <select value={f.stylist} onChange={(e) => setF({ ...f, stylist: e.target.value })} disabled={noStaff}>
        {data.employees.map((e2) => <option key={e2.id} value={e2.name}>{e2.name}</option>)}
      </select>
    </ModalShell>
  );
}

function ExpenseModal({ onClose, onSave }) {
  const [f, setF] = useState({ date: todayISO(), category: "Electricity", amount: "", note: "" });
  const isValid = Number(f.amount) > 0;
  return (
    <ModalShell title="New Expense" onClose={onClose} onSave={() => isValid && onSave({ ...f, amount: Number(f.amount) })} disabled={!isValid} hint="Amount is required.">
      <label className="field-label">Date</label>
      <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      <label className="field-label">Category</label>
      <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
        {["Electricity", "Rent", "Products", "Marketing", "Tea/Coffee", "Repairs", "Other"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <label className="field-label">Amount (₹) <span className="req">*</span></label>
      <input type="number" placeholder="e.g. 1500" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      <label className="field-label">Note (optional)</label>
      <input placeholder="e.g. July electricity bill" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
    </ModalShell>
  );
}

function ProductModal({ onClose, onSave, services, initial }) {
  const [f, setF] = useState(initial ? { ...initial } : { name: "", stock: 0, min: 5, supplier: "", purchasePrice: 0, sellingPrice: 0, retail: true, linkedService: "", usagePerService: 1 });
  const isValid = f.name.trim().length > 0 && f.supplier.trim().length > 0 && Number(f.sellingPrice) > 0;
  return (
    <ModalShell
      title={initial ? "Edit Product" : "New Product"}
      onClose={onClose}
      onSave={() => isValid && onSave(f)}
      disabled={!isValid}
      hint="Product name, supplier and selling price are required."
    >
      <label className="field-label">Product name <span className="req">*</span></label>
      <input placeholder="e.g. Cadiveu Shampoo" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />

      <label className="field-label">Supplier <span className="req">*</span></label>
      <input placeholder="e.g. Cadiveu" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />

      <div className="row-2">
        <div>
          <label className="field-label">Stock on hand</label>
          <input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} />
        </div>
        <div>
          <label className="field-label">Low-stock alert below</label>
          <input type="number" value={f.min} onChange={(e) => setF({ ...f, min: Number(e.target.value) })} />
        </div>
      </div>
      <div className="row-2">
        <div>
          <label className="field-label">Purchase price (₹)</label>
          <input type="number" value={f.purchasePrice} onChange={(e) => setF({ ...f, purchasePrice: Number(e.target.value) })} />
        </div>
        <div>
          <label className="field-label">Selling price (₹) <span className="req">*</span></label>
          <input type="number" value={f.sellingPrice} onChange={(e) => setF({ ...f, sellingPrice: Number(e.target.value) })} />
        </div>
      </div>
      <label className="field-label">How does stock get used?</label>
      <select value={f.retail ? "retail" : "salon"} onChange={(e) => setF({ ...f, retail: e.target.value === "retail" })}>
        <option value="retail">Sold directly to customers (retail)</option>
        <option value="salon">Used during a service (salon-use)</option>
      </select>
      {!f.retail && (
        <div className="row-2">
          <div>
            <label className="field-label">Linked service</label>
            <select value={f.linkedService} onChange={(e) => setF({ ...f, linkedService: e.target.value })}>
              <option value="">Link to service…</option>
              {(services || []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Used per service</label>
            <input type="number" min="0" step="0.1" value={f.usagePerService} onChange={(e) => setF({ ...f, usagePerService: Number(e.target.value) })} />
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function EmployeeModal({ onClose, onSave, initial }) {
  const [f, setF] = useState(initial ? { ...initial } : { name: "", role: "", phone: "", salary: 0, commissionPct: 20 });
  const isValid = f.name.trim().length > 0 && f.role.trim().length > 0 && f.phone.trim().length >= 4;
  return (
    <ModalShell
      title={initial ? "Edit Employee" : "New Employee"}
      onClose={onClose}
      onSave={() => isValid && onSave(f)}
      disabled={!isValid}
      hint="Name, role and phone are required."
    >
      <label className="field-label">Name <span className="req">*</span></label>
      <input placeholder="e.g. Ravi Kumar" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />

      <label className="field-label">Role <span className="req">*</span></label>
      <input placeholder="e.g. Senior Stylist" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />

      <label className="field-label">Phone <span className="req">*</span></label>
      <input placeholder="e.g. 9840011122" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />

      <div className="row-2">
        <div>
          <label className="field-label">Monthly salary (₹)</label>
          <input type="number" value={f.salary} onChange={(e) => setF({ ...f, salary: Number(e.target.value) })} />
        </div>
        <div>
          <label className="field-label">Commission %</label>
          <input type="number" value={f.commissionPct} onChange={(e) => setF({ ...f, commissionPct: Number(e.target.value) })} />
        </div>
      </div>
    </ModalShell>
  );
}

function ServiceModal({ onClose, onSave, initial }) {
  const [f, setF] = useState(initial ? { ...initial } : { name: "", price: 0, duration: 30, commission: 20 });
  const isValid = f.name.trim().length > 0 && Number(f.price) > 0;
  return (
    <ModalShell
      title={initial ? "Edit Service" : "New Service"}
      onClose={onClose}
      onSave={() => isValid && onSave(f)}
      disabled={!isValid}
      hint="Service name and price are required."
    >
      <label className="field-label">Service name <span className="req">*</span></label>
      <input placeholder="e.g. Haircut" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="row-2">
        <div>
          <label className="field-label">Price (₹) <span className="req">*</span></label>
          <input type="number" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
        </div>
        <div>
          <label className="field-label">Duration (min)</label>
          <input type="number" value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) })} />
        </div>
      </div>
      <label className="field-label">Staff commission %</label>
      <input type="number" value={f.commission} onChange={(e) => setF({ ...f, commission: Number(e.target.value) })} />
    </ModalShell>
  );
}

/* ---------------- Styles ---------------- */
function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');

      :root {
        --cream: #F8F4EE;
        --paper: #FFFFFF;
        --wine: #6A3F4D;
        --wine-deep: #4B2C37;
        --wine-soft: #F1E3E7;
        --gold: #B08D57;
        --gold-deep: #8F6F41;
        --ink: #2A2226;
        --ink-soft: #8C7B81;
        --sage: #6F7D5E;
        --rust: #AE5642;
        --line: #E8DFE1;
        --font-display: 'Fraunces', Georgia, serif;
        --font-ui: 'Inter', 'Helvetica Neue', Arial, sans-serif;
      }
      * { box-sizing: border-box; }
      .app-shell { display:flex; min-height:100vh; background:var(--cream); font-family: var(--font-ui); color:var(--ink); }
      .loading { padding:40px; font-family:var(--font-display); font-style:italic; color:var(--ink-soft); }

      .sidebar { width:226px; background:linear-gradient(180deg, var(--wine) 0%, var(--wine-deep) 100%); color:var(--cream); display:flex; flex-direction:column; padding:24px 16px; flex-shrink:0; }
      .brand { display:flex; align-items:center; gap:11px; margin-bottom:30px; padding:0 4px; }
      .brand-mark { width:38px; height:38px; border-radius:50%; background:var(--gold); border:2px solid rgba(248,244,238,.35); color:var(--wine-deep); display:flex; align-items:center; justify-content:center; font-weight:600; font-size:17px; font-family:var(--font-display); flex-shrink:0; }
      .brand-name { font-family:var(--font-display); font-size:14.5px; font-weight:600; letter-spacing:.01em; line-height:1.25; }
      .brand-sub { font-size:9.5px; color:#D9C3CB; text-transform:uppercase; letter-spacing:.16em; font-family:var(--font-ui); }
      .nav { display:flex; flex-direction:column; gap:2px; flex:1; font-family:var(--font-ui); }
      .nav-item { display:flex; align-items:center; gap:10px; padding:9px 11px; border-radius:8px; background:none; border:none; color:#E3CFD5; font-size:13px; text-align:left; cursor:pointer; transition:.15s; }
      .nav-item:hover { background:rgba(248,244,238,.1); color:#fff; }
      .nav-item.active { background:var(--gold); color:var(--wine-deep); font-weight:600; }
      .role-switch { font-family:var(--font-ui); font-size:11px; color:#D9C3CB; margin-top:16px; padding-top:14px; border-top:1px solid rgba(248,244,238,.18); }
      .role-switch label { display:block; margin-bottom:5px; text-transform:uppercase; letter-spacing:.1em; font-size:9.5px; }
      .role-switch select { width:100%; background:rgba(248,244,238,.12); color:#fff; border:1px solid rgba(248,244,238,.25); border-radius:6px; padding:5px 7px; font-size:12px; }

      .main { flex:1; padding:34px 42px; overflow-y:auto; }
      .page-head { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px; padding-bottom:18px; border-bottom:1px solid var(--line); position:relative; }
      .page-head::after { content:''; position:absolute; left:0; bottom:-1px; width:52px; height:2px; background:var(--gold); }
      .page-head h1 { font-family:var(--font-display); font-size:29px; margin:0; font-weight:600; letter-spacing:.005em; color:var(--wine-deep); }
      .page-head p { margin:5px 0 0; color:var(--ink-soft); font-family:var(--font-ui); font-size:12.5px; }

      .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
      .stat-card { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:17px 19px; border-left:3px solid var(--wine); box-shadow:0 1px 2px rgba(74,44,55,.04), 0 6px 16px rgba(74,44,55,.05); }
      .stat-card.tone-brass { border-left-color:var(--gold); }
      .stat-card.tone-sage { border-left-color:var(--sage); }
      .stat-card.tone-brick { border-left-color:var(--rust); }
      .stat-card.tone-ink { border-left-color:var(--wine); }
      .stat-value { font-family:var(--font-display); font-size:25px; font-weight:600; color:var(--wine-deep); }
      .stat-label { font-family:var(--font-ui); font-size:11px; color:var(--ink-soft); margin-top:4px; text-transform:uppercase; letter-spacing:.07em; }
      .quick-actions { display:flex; gap:10px; margin-bottom:26px; flex-wrap:wrap; }
      .qa { font-family:var(--font-ui); display:flex; align-items:center; gap:6px; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:9px 14px; font-size:12.5px; font-weight:500; cursor:pointer; color:var(--wine-deep); transition:.15s; }
      .qa:hover { border-color:var(--gold); background:var(--wine-soft); }
      .section-card { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:19px 21px; margin-bottom:16px; box-shadow:0 1px 2px rgba(74,44,55,.03); }
      .section-title { font-family:var(--font-display); font-weight:600; margin-bottom:13px; font-size:15.5px; color:var(--wine-deep); }
      .tbl { width:100%; border-collapse:collapse; font-family:var(--font-ui); font-size:13px; }
      .tbl th { text-align:left; color:var(--ink-soft); font-size:10.5px; text-transform:uppercase; letter-spacing:.06em; padding:7px 8px; border-bottom:1px solid var(--line); }
      .tbl td { padding:10px 8px; border-bottom:1px solid var(--line); }
      .tbl tr:hover td { background:var(--wine-soft); }
      .tbl tr.low { background:#F7E9E5; }
      .tbl tr.low:hover td { background:#F2DDD7; }
      .tag { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:20px; font-size:10.5px; font-weight:600; }
      .tag.brick { background:#F1DAD3; color:var(--rust); }
      .tag.sage { background:#E5E9DD; color:var(--sage); }
      .stock-btns button { width:24px; height:24px; border-radius:6px; border:1px solid var(--line); background:#fff; cursor:pointer; margin-right:4px; color:var(--wine-deep); }
      .stock-btns button:hover { border-color:var(--gold); }
      .cell-input { width:70px; font-family:var(--font-ui); padding:4px 6px; border:1px solid var(--line); border-radius:5px; }
      .empty { font-family:var(--font-ui); color:var(--ink-soft); font-size:12.5px; font-style:italic; padding:8px 2px; }
      .filter-row { display:flex; gap:10px; margin-bottom:18px; font-family:var(--font-ui); }
      .filter-row input, .filter-row select { padding:9px 11px; border:1px solid var(--line); border-radius:8px; background:var(--paper); font-size:12.5px; }
      .appt-list { display:flex; flex-direction:column; gap:8px; }
      .appt-row { display:flex; align-items:center; gap:16px; background:var(--paper); border:1px solid var(--line); border-radius:10px; padding:13px 17px; font-family:var(--font-ui); transition:.15s; }
      .appt-row:hover { border-color:var(--gold); }
      .appt-row.done { opacity:.5; }
      .appt-time { font-family:var(--font-display); font-weight:600; width:60px; color:var(--wine); font-size:14.5px; }
      .appt-body { flex:1; }
      .appt-cust { font-weight:600; font-size:13.5px; }
      .appt-meta { font-size:11.5px; color:var(--ink-soft); }
      .btn-ghost { font-family:var(--font-ui); background:none; border:1px solid var(--line); border-radius:7px; padding:6px 10px; font-size:11.5px; cursor:pointer; }
      .btn-ghost:hover { border-color:var(--gold); }
      .btn-ghost.danger { color:var(--rust); }
      .btn-primary { font-family:var(--font-ui); display:flex; align-items:center; gap:6px; justify-content:center; background:var(--wine); color:var(--cream); border:none; border-radius:8px; padding:10px 16px; font-size:12.5px; font-weight:600; cursor:pointer; transition:.15s; }
      .btn-primary:hover { background:var(--wine-deep); }
      .btn-primary:disabled { opacity:.4; cursor:not-allowed; }
      .btn-primary.full { width:100%; margin-top:14px; padding:11px; }
      .billing-grid { display:grid; grid-template-columns:1.5fr 1fr; gap:22px; }
      .billing-left input, .billing-left select, .billing-left textarea { width:100%; margin-bottom:12px; padding:9px 11px; border:1px solid var(--line); border-radius:8px; font-family:var(--font-ui); font-size:13px; background:var(--paper); }
      .field-label { display:block; font-family:var(--font-ui); font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-soft); margin-bottom:5px; }
      .service-check-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; }
      .service-check { display:flex; align-items:center; gap:8px; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:9px 11px; font-family:var(--font-ui); font-size:12.5px; cursor:pointer; transition:.15s; min-height:20px; }
      .service-check input[type="checkbox"] { flex-shrink:0; width:15px; height:15px; margin:0; accent-color:var(--wine); }
      .service-check span:first-of-type { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .service-check.on { border-color:var(--gold); background:var(--wine-soft); }
      .sc-price { flex-shrink:0; color:var(--ink-soft); font-size:11px; font-variant-numeric:tabular-nums; }
      .row-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .billing-right { position:sticky; top:10px; }
      .bill-summary { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:19px; font-family:var(--font-ui); box-shadow:0 1px 2px rgba(74,44,55,.04), 0 6px 16px rgba(74,44,55,.05); }
      .bs-title { font-family:var(--font-display); font-weight:600; font-size:15px; margin-bottom:11px; color:var(--wine-deep); }
      .bs-empty { color:var(--ink-soft); font-size:12px; font-style:italic; }
      .bs-line { display:flex; justify-content:space-between; font-size:12.5px; padding:4px 0; color:var(--ink-soft); }
      .bs-total { display:flex; justify-content:space-between; font-family:var(--font-display); font-weight:600; font-size:19px; color:var(--wine-deep); border-top:1px solid var(--line); margin-top:8px; padding-top:10px; }
      .search-row { display:flex; align-items:center; gap:8px; background:var(--paper); border:1px solid var(--line); border-radius:9px; padding:9px 13px; margin-bottom:16px; max-width:340px; color:var(--ink-soft); }
      .search-row input { border:none; background:none; outline:none; font-size:13px; width:100%; font-family:var(--font-ui); color:var(--ink); }
      .cust-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
      .cust-card { background:var(--paper); border:1px solid var(--line); border-radius:11px; padding:15px 17px; cursor:pointer; transition:.15s; }
      .cust-card:hover { border-color:var(--gold); }
      .cust-top { display:flex; justify-content:space-between; align-items:baseline; }
      .cust-name { font-family:var(--font-display); font-weight:600; font-size:14.5px; color:var(--wine-deep); }
      .badge { font-family:var(--font-ui); background:var(--gold); color:var(--wine-deep); font-size:9.5px; font-weight:600; padding:2px 8px; border-radius:20px; margin-left:6px; }
      .cust-phone { font-family:var(--font-ui); font-size:11.5px; color:var(--ink-soft); }
      .cust-meta { font-family:var(--font-ui); font-size:11.5px; color:var(--ink-soft); margin-top:5px; }
      .cust-detail { margin-top:12px; padding-top:10px; border-top:1px solid var(--line); font-family:var(--font-ui); font-size:12px; }
      .detail-row { margin-bottom:4px; }
      .visit-title { font-weight:700; margin:8px 0 4px; font-size:11.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-soft); }
      .visit-row { display:flex; justify-content:space-between; gap:8px; font-size:12px; padding:3px 0; }
      .emp-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
      .emp-card { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:17px 19px; box-shadow:0 1px 2px rgba(74,44,55,.03); }
      .emp-name { font-family:var(--font-display); font-weight:600; font-size:15.5px; color:var(--wine-deep); }
      .emp-role { font-family:var(--font-ui); font-size:11.5px; color:var(--ink-soft); margin-bottom:13px; }
      .emp-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; font-family:var(--font-ui); }
      .emp-stats span { display:block; font-weight:700; font-size:13px; color:var(--wine-deep); }
      .emp-stats label { font-size:9.5px; color:var(--ink-soft); text-transform:uppercase; }
      .reports-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px,1fr)); gap:14px; }
      .product-check-grid { display:flex; flex-direction:column; gap:8px; margin-bottom:6px; }
      .product-check { display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:9px 11px; font-family:var(--font-ui); }
      .product-check.oos { opacity:.5; }
      .pc-name { font-size:12.5px; font-weight:600; }
      .pc-meta { font-size:11px; color:var(--ink-soft); }
      .product-check input[type=number] { width:56px; padding:5px 6px; border:1px solid var(--line); border-radius:6px; text-align:center; }
      .stock-warning { font-family:var(--font-ui); font-size:11px; color:var(--rust); margin:-4px 0 12px; }
      .bar-row { display:grid; grid-template-columns:90px 1fr 70px; align-items:center; gap:8px; margin-bottom:9px; font-family:var(--font-ui); font-size:11.5px; }
      .bar-label { color:var(--ink-soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .bar-track { background:var(--line); border-radius:20px; height:7px; overflow:hidden; }
      .bar-fill { background:var(--gold); height:100%; }
      .bar-value { text-align:right; font-weight:600; color:var(--wine-deep); }
      .modal-backdrop { position:fixed; inset:0; background:rgba(42,34,38,.5); display:flex; align-items:center; justify-content:center; z-index:50; }
      .modal { background:var(--paper); border-radius:14px; padding:22px; width:380px; max-height:88vh; overflow-y:auto; position:relative; box-shadow:0 20px 60px rgba(42,34,38,.25); }
      .modal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
      .modal-head h3 { font-family:var(--font-display); margin:0; font-size:17px; color:var(--wine-deep); font-weight:600; }
      .modal-close { background:none; border:none; cursor:pointer; color:var(--ink-soft); }
      .modal-body input, .modal-body select, .modal-body textarea { width:100%; margin-bottom:10px; padding:9px 11px; border:1px solid var(--line); border-radius:8px; font-family:var(--font-ui); font-size:13px; }
      .receipt-modal { width:300px; font-family:'Courier New', monospace; }
      .receipt { text-align:center; }
      .receipt-brand { font-family:var(--font-display); font-weight:600; font-size:16px; letter-spacing:.02em; color:var(--wine-deep); }
      .receipt-sub { font-size:11px; color:var(--ink-soft); margin:3px 0; }
      .receipt-line { display:flex; justify-content:space-between; font-size:12.5px; padding:2px 0; text-align:left; }
      .receipt-total { display:flex; justify-content:space-between; font-weight:700; font-size:15px; margin-top:6px; }
      .receipt-footer { margin-top:10px; font-style:italic; font-size:11px; }
      .req { color:var(--rust); font-weight:700; }
      .qr-card { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:16px; margin-top:14px; text-align:center; font-family:var(--font-ui); box-shadow:0 1px 2px rgba(74,44,55,.04); }
      .qr-img { width:150px; height:150px; margin:8px auto; display:block; border-radius:6px; }
      .qr-fallback { font-size:11.5px; font-weight:600; color:var(--wine-deep); margin-top:2px; }
      .qr-note { font-size:11px; color:var(--ink-soft); margin-top:6px; font-style:italic; }
      .session-info { font-family:var(--font-ui); font-size:12.5px; color:#fff; font-weight:600; margin-bottom:8px; }
      .logout-btn { width:100%; font-family:var(--font-ui); background:rgba(248,244,238,.12); color:#fff; border:1px solid rgba(248,244,238,.25); border-radius:6px; padding:7px; font-size:12px; cursor:pointer; }
      .logout-btn:hover { background:rgba(248,244,238,.2); }
      .login-shell { min-height:100vh; width:100%; display:flex; align-items:center; justify-content:center; background:var(--cream); }
      .login-card { background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:34px 32px; width:340px; text-align:center; box-shadow:0 20px 60px rgba(42,34,38,.15); }
      .login-mark { margin:0 auto 14px; width:46px; height:46px; font-size:20px; }
      .login-card h2 { font-family:var(--font-display); font-size:20px; margin:0 0 2px; color:var(--wine-deep); }
      .login-sub { font-family:var(--font-ui); font-size:12px; color:var(--ink-soft); margin:0 0 20px; }
      .login-card .field-label { text-align:left; }
      .login-card input { width:100%; margin-bottom:12px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; font-family:var(--font-ui); font-size:13px; }
      .login-error { font-family:var(--font-ui); font-size:12px; color:var(--rust); margin:-4px 0 12px; text-align:left; }
      .login-hint { font-family:var(--font-ui); font-size:11px; color:var(--ink-soft); margin-top:16px; line-height:1.5; }
      .login-row { display:grid; grid-template-columns:90px 1fr 1fr; gap:8px; align-items:center; margin-bottom:10px; font-family:var(--font-ui); }
      .login-row-label { font-size:12.5px; font-weight:600; color:var(--wine-deep); }
      .login-row input { padding:8px 10px; border:1px solid var(--line); border-radius:7px; font-size:12.5px; }
      .send-row { display:flex; gap:8px; margin-top:8px; }
      .send-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; text-decoration:none; }
      .modal-hint { font-family:var(--font-ui); font-size:11px; color:var(--ink-soft); margin:-2px 0 4px; font-style:italic; }
      .cust-actions { display:flex; gap:6px; margin-top:10px; }
      .cust-actions .btn-ghost { display:flex; align-items:center; gap:4px; }
      .row-actions { display:flex; gap:4px; white-space:nowrap; }
      .row-actions .btn-ghost { padding:5px 7px; }
      .membership-toggle { display:flex; align-items:center; gap:8px; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:10px 12px; font-family:var(--font-ui); font-size:12.5px; cursor:pointer; margin:6px 0 12px; color:var(--wine-deep); }
      .membership-toggle.on { border-color:var(--gold); background:var(--wine-soft); }
      .membership-toggle input { width:auto; margin:0; }
      .toast { position:fixed; bottom:24px; right:24px; background:var(--wine-deep); color:var(--cream); padding:12px 18px; border-radius:10px; display:flex; align-items:center; gap:8px; font-family:var(--font-ui); font-size:13px; font-weight:500; box-shadow:0 12px 30px rgba(42,34,38,.3); z-index:100; animation:toast-in .2s ease-out; }
      @keyframes toast-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      @media print {
        .modal-close, .btn-primary { display:none !important; }
      }
      @media (max-width: 900px) {
        .app-shell { flex-direction:column; }
        .sidebar { width:100%; flex-direction:row; align-items:center; overflow-x:auto; }
        .nav { flex-direction:row; }
        .stat-grid, .reports-grid, .cust-grid, .emp-grid, .service-check-grid { grid-template-columns:1fr; }
        .billing-grid { grid-template-columns:1fr; }
      }
    `}</style>
  );
}
