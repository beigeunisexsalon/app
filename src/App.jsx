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
    salonName: "Beige Unisex Salon", gst: 5, footer: "Thank you for visiting!", upiId: "",
    nextBillNo: 1001,
    nextMembershipNo: 1,
    membershipPlan: {
      name: "Beige Rewards Membership",
      price: 499,
      validityDays: 365,
      serviceDiscountPct: 5,
      productDiscountPct: 0,
      loyaltyMultiplier: 2,
      birthdayDiscount: 100,
      priorityBooking: true,
      memberOnlyOffers: true,
    },
    loyalty: {
      pointsPer100: 10,          // regular customers earn this many points per ₹100 spent
      redemptionPointsPerRupee: 100, // 100 points = ₹1
      minRedemption: 1000,
      maxRedemptionPct: 20,      // max % of (discounted) bill that can be paid with points
    },
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
    { id: "walkin", name: "Walk-in", phone: "-", birthday: "", gender: "Other", notes: "", allergies: "", loyaltyPoints: 0, isWalkIn: true, membershipId: "", membershipStart: "", membershipExpiry: "", birthdayBenefitUsedYear: null },
    { id: "c1", name: "Sneha", phone: "9876543210", birthday: "1996-07-15", gender: "Female", notes: "", allergies: "", loyaltyPoints: 120, membershipId: "", membershipStart: "", membershipExpiry: "", birthdayBenefitUsedYear: null },
    { id: "c2", name: "Priya", phone: "9876500011", birthday: "1992-03-02", gender: "Female", notes: "", allergies: "", loyaltyPoints: 2540, membershipId: "BR-0001", membershipStart: todayISO(), membershipExpiry: addDays(todayISO(), 300), birthdayBenefitUsedYear: null },
  ],
  appointments: [
    { id: "a1", date: todayISO(), time: "09:00", customer: "Sneha", service: "Haircut", stylist: "Ravi Kumar", status: "pending" },
    { id: "a2", date: todayISO(), time: "10:00", customer: "Priya", service: "Hair Spa", stylist: "Meena", status: "pending" },
  ],
  inventory: [
    { id: "p1", name: "Cadiveu Shampoo", stock: 15, min: 5, supplier: "Cadiveu", purchasePrice: 680, sellingPrice: 950, retail: true, linkedService: "", usagePerService: 0 },
    { id: "p2", name: "Loreal Hair Color Tube", stock: 4, min: 6, supplier: "Loreal", purchasePrice: 220, sellingPrice: 350, retail: false, linkedService: "Hair Color", usagePerService: 1 },
    { id: "p3", name: "Wax Strips (box)", stock: 2, min: 4, supplier: "Local Supplier", purchasePrice: 150, sellingPrice: 250, retail: false, linkedService: "Waxing", usagePerService: 1 },
  ],
  expenses: [],
  bills: [],
  pointsLedger: [],
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
    `Receipt #${receipt.billNo} · ${receipt.date} — Bill for ${receipt.customer}`,
    ...receipt.items.map((i) => `${i.name} x${i.qty}: ${rupee(i.price * i.qty)}`),
    `Subtotal: ${rupee(receipt.subtotal)}`,
    receipt.membershipDiscount ? `Member discount: -${rupee(receipt.membershipDiscount)}` : null,
    receipt.birthdayDiscount ? `Birthday discount: -${rupee(receipt.birthdayDiscount)}` : null,
    receipt.loyaltyRedeemedValue ? `Loyalty redeemed (${receipt.loyaltyRedeemed} pts): -${rupee(receipt.loyaltyRedeemedValue)}` : null,
    receipt.discount ? `Discount: -${rupee(receipt.discount)}` : null,
    `GST: ${rupee(receipt.gst)}`,
    `TOTAL: ${rupee(receipt.total)}`,
    `Paid via ${receipt.paymentMethod}`,
    receipt.pointsEarned ? `Loyalty points earned: +${receipt.pointsEarned}` : null,
    settings.footer,
  ].filter(Boolean);
  return lines.join("\n");
}

// Minimal dependency-free PDF writer for the receipt. No external library needed
// (keeps this working both in the in-chat preview and the deployed site).
// Only plain ASCII is safe inside a non-embedded-font PDF, so non-ASCII characters
// are substituted with "?" and ₹ is written as "Rs." to avoid corrupt glyphs.
function toPdfAscii(s) { return String(s).replace(/[^\x20-\x7E]/g, "?"); }
function rsAscii(n) { return "Rs." + Number(n || 0).toLocaleString("en-IN"); }
function buildReceiptPdfBlob(receipt, settings) {
  const pad = (s, n) => (s.length >= n ? s + " " : s + " ".repeat(n - s.length));
  const lines = [];
  lines.push(toPdfAscii(settings.salonName));
  lines.push(`Receipt #${receipt.billNo}   ${receipt.date}`);
  lines.push(`Customer: ${toPdfAscii(receipt.customer)}`);
  lines.push("--------------------------------");
  receipt.items.forEach((i) => lines.push(pad(toPdfAscii(`${i.name} x${i.qty}`), 22) + rsAscii(i.price * i.qty)));
  lines.push("--------------------------------");
  lines.push(pad("Subtotal", 22) + rsAscii(receipt.subtotal));
  if (receipt.membershipDiscount) lines.push(pad("Member discount", 22) + "-" + rsAscii(receipt.membershipDiscount));
  if (receipt.birthdayDiscount) lines.push(pad("Birthday discount", 22) + "-" + rsAscii(receipt.birthdayDiscount));
  if (receipt.loyaltyRedeemedValue) lines.push(pad("Loyalty redeemed", 22) + "-" + rsAscii(receipt.loyaltyRedeemedValue));
  if (receipt.discount) lines.push(pad("Discount", 22) + "-" + rsAscii(receipt.discount));
  lines.push(pad("GST", 22) + rsAscii(receipt.gst));
  lines.push(pad("TOTAL", 22) + rsAscii(receipt.total));
  lines.push("");
  lines.push(`Payment mode: ${receipt.paymentMethod}`);
  if (receipt.pointsEarned) lines.push(`Loyalty points earned: +${receipt.pointsEarned}`);
  lines.push("");
  lines.push(toPdfAscii(settings.footer || ""));

  const leading = 13, marginTop = 26, marginBottom = 20, width = 260;
  const height = marginTop + marginBottom + lines.length * leading;
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  let content = `BT\n/F1 9 Tf\n${leading} TL\n10 ${height - marginTop} Td\n`;
  lines.forEach((line) => { content += `(${esc(line)}) Tj\nT*\n`; });
  content += "ET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}
function isMemberActive(c, today) { return !!(c && c.membershipExpiry && c.membershipExpiry >= (today || todayISO())); }
function membershipStatusLabel(c) {
  if (!c || !c.membershipExpiry) return "None";
  return isMemberActive(c) ? "Active" : "Expired";
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const ms = new Date(dateStr) - new Date(todayISO());
  return Math.round(ms / 86400000);
}
function isBirthdayMonth(birthday, today) {
  if (!birthday) return false;
  const t = today || todayISO();
  return birthday.slice(5, 7) === t.slice(5, 7);
}
function redeemableValue(points, loyaltyCfg) { return Math.floor((points || 0) / (loyaltyCfg.redemptionPointsPerRupee || 100)); }
function exportCSV(filename, headers, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
          parsed.customers.unshift({ id: "walkin", name: "Walk-in", phone: "-", birthday: "", gender: "Other", notes: "", allergies: "", loyaltyPoints: 0, isWalkIn: true, membershipId: "", membershipStart: "", membershipExpiry: "", birthdayBenefitUsedYear: null });
        }
        if (parsed.settings.upiId === undefined) parsed.settings.upiId = "";
        if (!parsed.settings.credentials) parsed.settings.credentials = seed.settings.credentials;
        if (!parsed.settings.membershipPlan) {
          parsed.settings.membershipPlan = { ...seed.settings.membershipPlan, price: parsed.settings.membershipFee || seed.settings.membershipPlan.price };
        }
        if (!parsed.settings.loyalty) parsed.settings.loyalty = seed.settings.loyalty;
        if (parsed.settings.nextBillNo === undefined) parsed.settings.nextBillNo = 1001;
        if (parsed.settings.nextMembershipNo === undefined) parsed.settings.nextMembershipNo = 1;
        if (!parsed.pointsLedger) parsed.pointsLedger = [];
        parsed.customers.forEach((c) => {
          if (c.membershipId === undefined) c.membershipId = c.membership === "Member" ? `BR-${String(Date.now()).slice(-4)}` : "";
          if (c.membershipStart === undefined) c.membershipStart = "";
          if (c.membershipExpiry === undefined) c.membershipExpiry = c.membership === "Member" ? addDays(todayISO(), 365) : "";
          if (c.birthdayBenefitUsedYear === undefined) c.birthdayBenefitUsedYear = null;
          if (c.loyaltyPoints === undefined) c.loyaltyPoints = 0;
        });
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
    { id: "membership", label: "Membership", icon: Star, roles: ["Admin"] },
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
        {activeTab === "bills" && <AllBills data={data} />}
        {activeTab === "customers" && <Customers data={data} update={update} openModal={setModal} notify={notify} role={role} />}
        {activeTab === "membership" && <MembershipDashboard data={data} />}
        {activeTab === "inventory" && <Inventory data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "services" && <Services data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "employees" && <Employees data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "expenses" && <Expenses data={data} update={update} openModal={setModal} notify={notify} />}
        {activeTab === "reports" && <Reports data={data} />}
        {activeTab === "settings" && <SettingsTab data={data} update={update} notify={notify} />}
      </main>

      {modal?.type === "customer" && (
        <CustomerModal
          initial={modal.payload}
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
          onQuickAddCustomer={(c) => {
            const id = uid("c");
            update((d) => d.customers.push({
              id, name: c.name.trim(), phone: c.phone.trim(), gender: c.gender,
              birthday: "", notes: "", allergies: "", loyaltyPoints: 0,
              membershipId: "", membershipStart: "", membershipExpiry: "", birthdayBenefitUsedYear: null,
            }));
            notify("Customer added");
            return id;
          }}
        />
      )}
      {modal?.type === "expense" && (
        <ExpenseModal
          initial={modal.payload}
          onClose={() => setModal(null)}
          onSave={(e) => {
            update((d) => {
              if (modal.payload) {
                const idx = d.expenses.findIndex((x) => x.id === modal.payload.id);
                if (idx > -1) d.expenses[idx] = { ...d.expenses[idx], ...e };
              } else {
                d.expenses.push({ ...e, id: uid("x") });
              }
            });
            notify(modal.payload ? "Expense updated" : "Expense added");
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
  const walkins = todaysBills.filter((b) => b.customer === "Walk-in").length;
  const lowStock = data.inventory.filter((p) => p.stock <= p.min).length;
  const recent = [...data.bills].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 6);
  const birthdays = data.customers.filter((c) => c.id !== "walkin" && c.birthday && isBirthdayMonth(c.birthday))
    .sort((a, b) => a.birthday.slice(5, 10).localeCompare(b.birthday.slice(5, 10)));

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
      {birthdays.length > 0 && (
        <SectionCard title={`🎂 Birthdays This Month (${birthdays.length})`}>
          <div className="birthday-list">
            {birthdays.map((c) => {
              const phoneDigits = formatPhoneIntl(c.phone);
              const canSend = phoneDigits.length >= 11;
              const msg = `Hi ${c.name}, Happy Birthday from ${data.settings.salonName}! 🎉 Enjoy 10% off all services this month as our gift to you — we'd love to see you. Visit us soon!`;
              return (
                <div key={c.id} className="birthday-row">
                  <div>
                    <div className="birthday-name">{c.name}</div>
                    <div className="birthday-date">{c.birthday.slice(5, 10)}</div>
                  </div>
                  {canSend ? (
                    <a className="btn-ghost send-btn" style={{ flex: "none" }} href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={13} />Send Wish
                    </a>
                  ) : <span className="qr-note">No phone on file</span>}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
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
  const [applyBirthday, setApplyBirthday] = useState(false);
  const [redeemInput, setRedeemInput] = useState(0);
  const [staff, setStaff] = useState(data.employees[0]?.name || "");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState("Cash");
  const [stockWarning, setStockWarning] = useState("");

  const plan = data.settings.membershipPlan;
  const loyaltyCfg = data.settings.loyalty;
  const customer = data.customers.find((c) => c.id === customerId);
  const retailProducts = data.inventory.filter((p) => p.retail !== false);
  const isMember = isMemberActive(customer);
  const canUseBirthday = isMember && customer && isBirthdayMonth(customer.birthday) && customer.birthdayBenefitUsedYear !== new Date().getFullYear();

  const serviceItems = data.services.filter((s) => selected[s.id] > 0)
    .map((s) => ({ type: "service", name: s.name, price: s.price, qty: selected[s.id] }));
  const productItems = retailProducts.filter((p) => products[p.id] > 0)
    .map((p) => ({ type: "product", name: p.name, price: p.sellingPrice, qty: products[p.id] }));
  const isRenewal = isMember;
  const membershipItem = addMembership ? [{ type: "membership", name: isRenewal ? `${plan.name} (renewal)` : `${plan.name} (new)`, price: plan.price, qty: 1 }] : [];
  const items = [...serviceItems, ...productItems, ...membershipItem];

  const serviceSubtotal = serviceItems.reduce((s, i) => s + i.price * i.qty, 0);
  const productSubtotal = productItems.reduce((s, i) => s + i.price * i.qty, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  const membershipDiscountAmt = isMember
    ? Math.round(serviceSubtotal * (plan.serviceDiscountPct || 0) / 100) + Math.round(productSubtotal * (plan.productDiscountPct || 0) / 100)
    : 0;
  const birthdayDiscountAmt = applyBirthday && canUseBirthday ? Math.min(plan.birthdayDiscount, subtotal) : 0;
  const manualDiscount = Number(discount) || 0;

  const availablePoints = customer?.loyaltyPoints || 0;
  const preRedeemTotal = Math.max(0, subtotal - membershipDiscountAmt - birthdayDiscountAmt - manualDiscount);
  const maxRedeemableRupees = Math.floor(preRedeemTotal * (loyaltyCfg.maxRedemptionPct || 0) / 100);
  const maxRedeemablePoints = Math.min(availablePoints, maxRedeemableRupees * loyaltyCfg.redemptionPointsPerRupee);
  const redeemPoints = Math.max(0, Math.min(Number(redeemInput) || 0, availablePoints));
  const redeemValue = Math.floor(redeemPoints / (loyaltyCfg.redemptionPointsPerRupee || 100));
  let redeemError = "";
  if (redeemPoints > 0 && redeemPoints < loyaltyCfg.minRedemption) redeemError = `Minimum redemption is ${loyaltyCfg.minRedemption} points.`;
  else if (redeemPoints > availablePoints) redeemError = "Not enough points available.";
  else if (redeemValue > maxRedeemableRupees) redeemError = `Max redeemable on this bill is ${maxRedeemablePoints} points (${loyaltyCfg.maxRedemptionPct}% of bill).`;
  const effectiveRedeemValue = redeemError ? 0 : redeemValue;
  const effectiveRedeemPoints = redeemError ? 0 : redeemPoints;

  const totalDiscount = membershipDiscountAmt + birthdayDiscountAmt + manualDiscount + effectiveRedeemValue;
  const gstAmt = Math.round(Math.max(0, subtotal - totalDiscount) * (data.settings.gst || 0) / 100);
  const total = Math.max(0, subtotal - totalDiscount) + gstAmt;

  const eligibleSpend = Math.max(0, subtotal - totalDiscount); // basis for earning points (pre-GST)
  const pointsRate = isMember ? (loyaltyCfg.pointsPer100 || 0) * (plan.loyaltyMultiplier || 1) : (loyaltyCfg.pointsPer100 || 0);
  const pointsToEarn = Math.round((eligibleSpend / 100) * pointsRate);

  const toggleService = (id) => setSelected((s) => ({ ...s, [id]: s[id] ? 0 : 1 }));
  const setProductQty = (id, qty, max) => {
    const capped = Math.max(0, Math.min(qty, max));
    setProducts((p) => ({ ...p, [id]: capped }));
    setStockWarning(qty > max ? "Quantity capped at available stock." : "");
  };

  const generate = () => {
    if (items.length === 0 || !customer || redeemError) return;
    const billNo = data.settings.nextBillNo;
    const bill = {
      id: uid("b"), billNo, date: todayISO(), customer: customer.name, customerId: customer.id, customerPhone: customer.phone,
      items, discount: manualDiscount, membershipDiscount: membershipDiscountAmt, birthdayDiscount: birthdayDiscountAmt,
      loyaltyRedeemed: effectiveRedeemPoints, loyaltyRedeemedValue: effectiveRedeemValue, pointsEarned: pointsToEarn,
      gst: gstAmt, subtotal, total, paymentMethod: payment, staff,
    };
    update((d) => {
      d.bills.push(bill);
      d.settings.nextBillNo = (d.settings.nextBillNo || 1001) + 1;
      const cust = d.customers.find((c) => c.id === customerId);
      if (cust) {
        let balance = cust.loyaltyPoints || 0;
        if (effectiveRedeemPoints > 0) {
          balance -= effectiveRedeemPoints;
          d.pointsLedger.push({ id: uid("pl"), date: todayISO(), customerId: cust.id, customerName: cust.name, reason: `Redeemed on Bill #${billNo}`, points: -effectiveRedeemPoints, balanceAfter: balance, staff, billId: bill.id });
        }
        balance += pointsToEarn;
        if (pointsToEarn > 0) {
          d.pointsLedger.push({ id: uid("pl"), date: todayISO(), customerId: cust.id, customerName: cust.name, reason: `Bill #${billNo}`, points: pointsToEarn, balanceAfter: balance, staff, billId: bill.id });
        }
        cust.loyaltyPoints = balance;
        if (applyBirthday && canUseBirthday) cust.birthdayBenefitUsedYear = new Date().getFullYear();
        if (addMembership) {
          if (!cust.membershipId) {
            cust.membershipId = `BR-${String(d.settings.nextMembershipNo).padStart(4, "0")}`;
            d.settings.nextMembershipNo = (d.settings.nextMembershipNo || 1) + 1;
          }
          const base = isMemberActive(cust) ? cust.membershipExpiry : todayISO();
          if (!isMemberActive(cust)) cust.membershipStart = todayISO();
          cust.membershipExpiry = addDays(base, plan.validityDays);
          cust.membershipPlanName = plan.name;
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
    setSelected({}); setProducts({}); setDiscount(0); setAddMembership(false); setApplyBirthday(false); setRedeemInput(0);
  };

  return (
    <div>
      <PageHead title="Billing" sub="Create a new bill" />
      <div className="billing-grid">
        <div className="billing-left">
          <label className="field-label">Customer <span className="req">*</span></label>
          <div className="row-2" style={{ gridTemplateColumns: "1fr auto" }}>
            <CustomerPicker customers={data.customers} value={customerId} onChange={(id) => { setCustomerId(id); setRedeemInput(0); setApplyBirthday(false); }} />
            <button type="button" className="btn-ghost" onClick={() => openModal({ type: "customer" })}><Plus size={13} />New</button>
          </div>

          {isMember && (
            <div className="member-banner">
              <Star size={14} /> {plan.name} Member · {plan.serviceDiscountPct}% service discount applied
              <span className="member-banner-sub">Renews {customer.membershipExpiry}{daysUntil(customer.membershipExpiry) <= 15 ? ` · expires in ${daysUntil(customer.membershipExpiry)}d` : ""}</span>
            </div>
          )}

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

          {availablePoints > 0 && (
            <div className="loyalty-box">
              <div className="loyalty-box-head">Loyalty points available: <b>{availablePoints}</b> ({rupee(redeemableValue(availablePoints, loyaltyCfg))})</div>
              <div className="row-2" style={{ gridTemplateColumns: "1fr auto" }}>
                <input type="number" min="0" placeholder="Points to redeem" value={redeemInput || ""} onChange={(e) => setRedeemInput(e.target.value)} />
                <button type="button" className="btn-ghost" onClick={() => setRedeemInput(maxRedeemablePoints)}>Use max</button>
              </div>
              {redeemError ? <div className="stock-warning">{redeemError}</div> : redeemPoints > 0 && <div className="qr-note">Redeeming {redeemPoints} pts = -{rupee(redeemValue)}</div>}
            </div>
          )}

          {canUseBirthday && (
            <label className={"membership-toggle" + (applyBirthday ? " on" : "")}>
              <input type="checkbox" checked={applyBirthday} onChange={(e) => setApplyBirthday(e.target.checked)} />
              🎂<span>Apply birthday discount — {rupee(plan.birthdayDiscount)} (once a year)</span>
            </label>
          )}

          <label className={"membership-toggle" + (addMembership ? " on" : "")}>
            <input type="checkbox" checked={addMembership} onChange={(e) => setAddMembership(e.target.checked)} />
            <Star size={14} />
            <span>{isMember ? "Renew" : "Buy"} {plan.name} for {customer?.name || "this customer"} — {rupee(plan.price)}{isMember ? ` (extends to ${addDays(customer.membershipExpiry, plan.validityDays)})` : ` (valid ${plan.validityDays} days)`}</span>
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
            {membershipDiscountAmt > 0 && <div className="bs-line member-line"><span>Member discount ({plan.serviceDiscountPct}%)</span><span>-{rupee(membershipDiscountAmt)}</span></div>}
            {birthdayDiscountAmt > 0 && <div className="bs-line member-line"><span>🎂 Birthday discount</span><span>-{rupee(birthdayDiscountAmt)}</span></div>}
            {effectiveRedeemValue > 0 && <div className="bs-line member-line"><span>Loyalty redeemed ({effectiveRedeemPoints} pts)</span><span>-{rupee(effectiveRedeemValue)}</span></div>}
            <div className="bs-line"><span>Discount</span><span>-{rupee(manualDiscount)}</span></div>
            <div className="bs-line"><span>GST ({data.settings.gst}%)</span><span>{rupee(gstAmt)}</span></div>
            <div className="bs-total"><span>Total</span><span>{rupee(total)}</span></div>
            {pointsToEarn > 0 && <div className="qr-note">Customer will earn {pointsToEarn} loyalty points on this bill{isMember ? ` (2× member rate)` : ""}.</div>}
            <button className="btn-primary full" disabled={items.length === 0 || !customer || !!redeemError} onClick={generate}>Generate Bill</button>
          </div>

          {payment === "UPI" && total > 0 && (
            <div className="qr-card">
              {data.settings.upiId ? (
                <>
                  <div className="bs-title">Scan to pay</div>
                  <img className="qr-img" src={qrImageUrl(buildUpiLink(data.settings.upiId, data.settings.salonName, total, `Bill for ${customer?.name || "customer"}`))} alt="UPI payment QR code" />
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
  const pdfFilename = `Receipt-${receipt.billNo}.pdf`;

  const downloadPdf = () => {
    const blob = buildReceiptPdfBlob(receipt, settings);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = pdfFilename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const shareReceipt = async () => {
    const blob = buildReceiptPdfBlob(receipt, settings);
    const file = new File([blob], pdfFilename, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Receipt #${receipt.billNo}`, text: `Receipt from ${settings.salonName}` });
        notify && notify("Receipt shared");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // user cancelled the share sheet
      }
    }
    // Fallback for browsers that can't share files (mostly desktop): download the PDF
    // and open WhatsApp with a text message, since a link can never auto-attach a file.
    downloadPdf();
    if (canSend) window.open(waLink, "_blank");
    notify && notify("PDF downloaded — attach it in the WhatsApp chat that just opened");
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal receipt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>
        <div className="receipt" id="print-area">
          <div className="receipt-brand">{settings.salonName}</div>
          <div className="receipt-sub">Receipt #{receipt.billNo} · {receipt.date}</div>
          <div className="receipt-sub">{receipt.customer}</div>
          <hr />
          {receipt.items.map((i, idx) => (
            <div key={idx} className="receipt-line"><span>{i.name} x{i.qty}</span><span>{rupee(i.price * i.qty)}</span></div>
          ))}
          <hr />
          <div className="receipt-line"><span>Subtotal</span><span>{rupee(receipt.subtotal)}</span></div>
          {receipt.membershipDiscount > 0 && <div className="receipt-line"><span>⭐ Member discount</span><span>-{rupee(receipt.membershipDiscount)}</span></div>}
          {receipt.birthdayDiscount > 0 && <div className="receipt-line"><span>🎂 Birthday discount</span><span>-{rupee(receipt.birthdayDiscount)}</span></div>}
          {receipt.loyaltyRedeemedValue > 0 && <div className="receipt-line"><span>Loyalty redeemed ({receipt.loyaltyRedeemed} pts)</span><span>-{rupee(receipt.loyaltyRedeemedValue)}</span></div>}
          <div className="receipt-line"><span>Discount</span><span>-{rupee(receipt.discount)}</span></div>
          <div className="receipt-line"><span>GST</span><span>{rupee(receipt.gst)}</span></div>
          <div className="receipt-total"><span>TOTAL</span><span>{rupee(receipt.total)}</span></div>
          <div className="receipt-line"><span>Payment mode</span><span>{receipt.paymentMethod}</span></div>
          {receipt.pointsEarned > 0 && <div className="receipt-sub">Loyalty points earned: +{receipt.pointsEarned}</div>}
          {receipt.paymentMethod === "UPI" && settings.upiId && (
            <div className="qr-card" style={{ border: "none", boxShadow: "none", padding: "10px 0 0" }}>
              <img className="qr-img" src={qrImageUrl(buildUpiLink(settings.upiId, settings.salonName, receipt.total, `Bill for ${receipt.customer}`))} alt="UPI payment QR code" />
            </div>
          )}
          <div className="receipt-footer">{settings.footer}</div>
        </div>
        <button className="btn-primary full" onClick={() => { window.print(); notify && notify("Receipt generated & sent to printer"); }}><Printer size={15} />Print</button>
        <button className="btn-ghost full" style={{ marginTop: 8 }} onClick={downloadPdf}><FileText size={14} />Download PDF</button>
        {canSend ? (
          <>
            <div className="send-row" style={{ marginTop: 8 }}>
              <button className="btn-ghost send-btn" onClick={shareReceipt}><MessageCircle size={14} />Share PDF via WhatsApp</button>
              <a className="btn-ghost send-btn" href={smsLink} onClick={() => notify && notify("Opening Messages with the bill as text")}>
                <Smartphone size={14} />SMS (text)
              </a>
            </div>
            <div className="qr-note" style={{ marginTop: 6 }}>On phone/tablet, "Share PDF" opens the share sheet with the real receipt attached — pick WhatsApp there. On desktop it downloads the PDF and opens WhatsApp for you to attach manually. SMS can only ever send text, never a file.</div>
          </>
        ) : (
          <div className="qr-note" style={{ marginTop: 8 }}>No valid phone number on file — add one to this customer's profile to send bills directly.</div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Customers ---------------- */
function Customers({ data, update, openModal, notify, role }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [adjustFor, setAdjustFor] = useState(null);
  const [adjustAmt, setAdjustAmt] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const list = data.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));
  const plan = data.settings.membershipPlan;
  const loyaltyCfg = data.settings.loyalty;

  const remove = (c) => {
    if (c.id === "walkin") return;
    if (!window.confirm(`Delete ${c.name}'s profile? This can't be undone.`)) return;
    update((d) => { d.customers = d.customers.filter((x) => x.id !== c.id); });
    notify("Customer deleted");
  };

  const submitAdjust = (c) => {
    const amt = Number(adjustAmt);
    if (!amt || !adjustReason.trim()) { notify("Enter an amount and a reason"); return; }
    update((d) => {
      const cust = d.customers.find((x) => x.id === c.id);
      const balance = (cust.loyaltyPoints || 0) + amt;
      cust.loyaltyPoints = Math.max(0, balance);
      d.pointsLedger.push({ id: uid("pl"), date: todayISO(), customerId: c.id, customerName: c.name, reason: `Manual adjustment: ${adjustReason.trim()}`, points: amt, balanceAfter: cust.loyaltyPoints, staff: "Admin" });
    });
    notify("Points adjusted");
    setAdjustFor(null); setAdjustAmt(""); setAdjustReason("");
  };

  const exportCustomers = () => {
    const rows = data.customers.filter((c) => c.id !== "walkin").map((c) => {
      const bills = data.bills.filter((b) => b.customerId === c.id || b.customer === c.name);
      return {
        Name: c.name, Phone: c.phone, Gender: c.gender, Birthday: c.birthday || "",
        MembershipStatus: membershipStatusLabel(c), MembershipId: c.membershipId || "",
        MembershipExpiry: c.membershipExpiry || "", LoyaltyPoints: c.loyaltyPoints || 0,
        Visits: bills.length, TotalSpend: bills.reduce((s, b) => s + b.total, 0),
      };
    });
    exportCSV("customers.csv",
      ["Name", "Phone", "Gender", "Birthday", "MembershipStatus", "MembershipId", "MembershipExpiry", "LoyaltyPoints", "Visits", "TotalSpend"],
      rows);
  };

  return (
    <div>
      <PageHead title="Customers" sub={`${data.customers.length} profiles`} action={
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost" onClick={exportCustomers}><FileText size={13} />Export CSV</button>
          <button className="btn-primary" onClick={() => openModal({ type: "customer" })}><Plus size={15} />New Customer</button>
        </div>
      } />
      <div className="search-row"><Search size={15} /><input placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="cust-grid">
        {list.map((c) => {
          const bills = data.bills.filter((b) => b.customerId === c.id || b.customer === c.name);
          const totalSpend = bills.reduce((s, b) => s + b.total, 0);
          const status = membershipStatusLabel(c);
          const dLeft = daysUntil(c.membershipExpiry);
          const history = data.pointsLedger.filter((p) => p.customerId === c.id).slice().reverse();
          return (
            <div key={c.id} className="cust-card">
              <div className="cust-top" onClick={() => setOpen(open === c.id ? null : c.id)} style={{ cursor: "pointer" }}>
                <div className="cust-name">{c.name} {status === "Active" && <span className="badge">Member</span>}{status === "Expired" && <span className="badge badge-expired">Expired</span>}</div>
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
                  <div className="detail-row"><b>Visits:</b> {bills.length} · <b>Total spend:</b> {rupee(totalSpend)}</div>

                  <div className="mini-card">
                    <div className="mini-card-title">Membership — {status}</div>
                    {status === "None" ? (
                      <div className="bs-empty">Not a member yet. Sell {plan.name} from Billing.</div>
                    ) : (
                      <>
                        <div className="detail-row">{c.membershipPlanName || plan.name} · ID {c.membershipId}</div>
                        <div className="detail-row">Started {c.membershipStart} → Renews {c.membershipExpiry}</div>
                        {status === "Active" && dLeft <= 15 && <div className="detail-row expiring">Expires in {dLeft} day{dLeft === 1 ? "" : "s"}</div>}
                        <div className="detail-row">{plan.serviceDiscountPct}% service discount · {plan.loyaltyMultiplier}× points while active</div>
                      </>
                    )}
                  </div>

                  <div className="mini-card">
                    <div className="mini-card-title">Loyalty points</div>
                    <div className="detail-row">Balance: <b>{c.loyaltyPoints || 0}</b> pts = {rupee(redeemableValue(c.loyaltyPoints, loyaltyCfg))}</div>
                    {role === "Admin" && (
                      adjustFor === c.id ? (
                        <div className="adjust-row">
                          <input type="number" placeholder="+/- points" value={adjustAmt} onChange={(e) => setAdjustAmt(e.target.value)} />
                          <input placeholder="Reason (required)" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
                          <button className="btn-ghost" onClick={() => submitAdjust(c)}>Save</button>
                          <button className="btn-ghost" onClick={() => setAdjustFor(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn-ghost" onClick={() => setAdjustFor(c.id)}><Pencil size={12} />Adjust points</button>
                      )
                    )}
                    {history.length > 0 && (
                      <>
                        <div className="visit-title">Points history</div>
                        {history.slice(0, 6).map((h) => (
                          <div key={h.id} className="visit-row"><span>{h.date}</span><span>{h.reason}</span><span>{h.points > 0 ? "+" : ""}{h.points} → {h.balanceAfter}</span></div>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="visit-title">Visit history</div>
                  {bills.length === 0 ? <div className="bs-empty">No visits yet</div> :
                    bills.map((b) => (
                      <div key={b.id} className="visit-row"><span>{b.date}</span><span>{b.items.map((i) => i.name).join(", ")}</span><span>{rupee(b.total)}</span></div>
                    ))}
                </div>
              )}
            </div>
          );
        })}
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
function Expenses({ data, update, openModal, notify }) {
  const month = todayISO().slice(0, 7);
  const monthTotal = data.expenses.filter((e) => e.date.slice(0, 7) === month).reduce((s, e) => s + Number(e.amount), 0);
  const remove = (ex) => {
    if (!window.confirm(`Delete this ${ex.category} expense of ${rupee(ex.amount)}?`)) return;
    update((d) => { d.expenses = d.expenses.filter((x) => x.id !== ex.id); });
    notify("Expense deleted");
  };
  return (
    <div>
      <PageHead title="Expenses" sub={`This month: ${rupee(monthTotal)}`} action={
        <button className="btn-primary" onClick={() => openModal({ type: "expense" })}><Plus size={15} />New Expense</button>
      } />
      <table className="tbl">
        <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          {[...data.expenses].reverse().map((e) => (
            <tr key={e.id}>
              <td>{e.date}</td><td>{e.category}</td><td>{e.note}</td><td>{rupee(e.amount)}</td>
              <td className="row-actions">
                <button className="btn-ghost" onClick={() => openModal({ type: "expense", payload: e })}><Pencil size={12} /></button>
                <button className="btn-ghost danger" onClick={() => remove(e)}><Trash2 size={12} /></button>
              </td>
            </tr>
          ))}
          {data.expenses.length === 0 && <tr><td colSpan="5"><Empty text="No expenses logged yet." /></td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- All Bills ---------------- */
function AllBills({ data }) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = [...data.bills]
    .filter((b) => (q ? (b.customer.toLowerCase().includes(q.toLowerCase()) || String(b.billNo).includes(q.trim())) : true))
    .filter((b) => (from ? b.date >= from : true))
    .filter((b) => (to ? b.date <= to : true))
    .sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  const totalShown = list.reduce((s, b) => s + b.total, 0);

  return (
    <div>
      <PageHead title="All Bills" sub={`${list.length} bills · ${rupee(totalShown)} shown`} />
      <div className="filter-row">
        <input placeholder="Search by customer or receipt #" value={q} onChange={(e) => setQ(e.target.value)} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        {(q || from || to) && <button className="btn-ghost" onClick={() => { setQ(""); setFrom(""); setTo(""); }}>Clear</button>}
      </div>
      <table className="tbl">
        <thead><tr><th>Receipt #</th><th>Date</th><th>Customer</th><th>Staff</th><th>Items</th><th>Payment</th><th>Total</th></tr></thead>
        <tbody>
          {list.map((b) => (
            <tr key={b.id}>
              <td>{b.billNo}</td><td>{b.date}</td><td>{b.customer}</td><td>{b.staff}</td>
              <td>{b.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</td>
              <td>{b.paymentMethod}</td><td>{rupee(b.total)}</td>
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
  const [period, setPeriod] = useState("month"); // month | year | all
  const [selMonth, setSelMonth] = useState(todayISO().slice(0, 7));
  const [selYear, setSelYear] = useState(todayISO().slice(0, 4));

  const inPeriod = (dateStr) => {
    if (period === "month") return dateStr.slice(0, 7) === selMonth;
    if (period === "year") return dateStr.slice(0, 4) === selYear;
    return true;
  };
  const periodLabel = period === "month" ? selMonth : period === "year" ? selYear : "All-time";

  const periodBills = data.bills.filter((b) => inPeriod(b.date));
  const periodSales = periodBills.reduce((s, b) => s + b.total, 0);
  const periodExpenses = data.expenses.filter((e) => inPeriod(e.date)).reduce((s, e) => s + Number(e.amount), 0);
  const profit = periodSales - periodExpenses;

  const serviceAgg = {};
  const productAgg = {};
  periodBills.forEach((b) => b.items.forEach((i) => {
    const bucket = i.type === "product" ? productAgg : serviceAgg;
    bucket[i.name] = (bucket[i.name] || 0) + i.price * i.qty;
  }));
  const topServices = Object.entries(serviceAgg).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topProducts = Object.entries(productAgg).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const staffAgg = {};
  periodBills.forEach((b) => { staffAgg[b.staff] = (staffAgg[b.staff] || 0) + b.total; });
  const topStaff = Object.entries(staffAgg).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const payAgg = { Cash: 0, UPI: 0, Card: 0 };
  periodBills.forEach((b) => { payAgg[b.paymentMethod] = (payAgg[b.paymentMethod] || 0) + b.total; });

  const exportBills = () => {
    const rows = periodBills.map((b) => ({
      ReceiptNo: b.billNo, Date: b.date, Customer: b.customer, Staff: b.staff,
      Items: b.items.map((i) => `${i.name} x${i.qty}`).join("; "),
      Subtotal: b.subtotal, Discount: b.discount, MembershipDiscount: b.membershipDiscount || 0,
      LoyaltyRedeemed: b.loyaltyRedeemedValue || 0, GST: b.gst, Total: b.total,
      PaymentMode: b.paymentMethod, PointsEarned: b.pointsEarned || 0,
    }));
    exportCSV(`bills_${periodLabel}.csv`,
      ["ReceiptNo", "Date", "Customer", "Staff", "Items", "Subtotal", "Discount", "MembershipDiscount", "LoyaltyRedeemed", "GST", "Total", "PaymentMode", "PointsEarned"],
      rows);
  };

  return (
    <div>
      <PageHead title="Reports" sub={`Showing: ${periodLabel}`} action={
        <div className="reports-controls">
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="month">Month</option>
            <option value="year">Year</option>
            <option value="all">All-time</option>
          </select>
          {period === "month" && <input type="month" value={selMonth} onChange={(e) => setSelMonth(e.target.value)} />}
          {period === "year" && (
            <select value={selYear} onChange={(e) => setSelYear(e.target.value)}>
              {Array.from({ length: 6 }, (_, i) => String(Number(todayISO().slice(0, 4)) - i)).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <button className="btn-primary" onClick={exportBills}><FileText size={14} />Export CSV</button>
        </div>
      } />
      <div className="stat-grid">
        <StatCard label="Sales" value={rupee(periodSales)} tone="ink" />
        <StatCard label="Expenses" value={rupee(periodExpenses)} tone="brick" />
        <StatCard label="Profit" value={rupee(profit)} tone={profit >= 0 ? "sage" : "brick"} />
        <StatCard label="Bills" value={periodBills.length} tone="brass" />
      </div>
      <div className="reports-grid">
        <SectionCard title="Top Services">
          {topServices.length === 0 ? <Empty text="No sales in this period yet." /> : topServices.map(([name, val]) => <Bar key={name} label={name} value={val} max={topServices[0][1]} />)}
        </SectionCard>
        <SectionCard title="Top Retail Products">
          {topProducts.length === 0 ? <Empty text="No retail sales in this period yet." /> : topProducts.map(([name, val]) => <Bar key={name} label={name} value={val} max={topProducts[0][1]} />)}
        </SectionCard>
        <SectionCard title="Top Employees">
          {topStaff.length === 0 ? <Empty text="No sales in this period yet." /> : topStaff.map(([name, val]) => <Bar key={name} label={name} value={val} max={topStaff[0][1]} />)}
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

/* ---------------- Membership Dashboard ---------------- */
function MembershipDashboard({ data }) {
  const month = todayISO().slice(0, 7);
  const plan = data.settings.membershipPlan;
  const members = data.customers.filter((c) => c.membershipId);
  const active = members.filter((c) => isMemberActive(c));
  const expiringSoon = active.filter((c) => daysUntil(c.membershipExpiry) <= 15);
  const expired = members.filter((c) => !isMemberActive(c));

  const membershipBills = data.bills.filter((b) => b.items.some((i) => i.type === "membership"));
  const membershipBillsMonth = membershipBills.filter((b) => b.date.slice(0, 7) === month);
  const newThisMonth = membershipBillsMonth.filter((b) => b.items.some((i) => i.name.includes("(new)")));
  const renewalsThisMonth = membershipBillsMonth.filter((b) => b.items.some((i) => i.name.includes("(renewal)")));
  const membershipRevenue = membershipBillsMonth.reduce((s, b) => s + b.items.filter((i) => i.type === "membership").reduce((s2, i) => s2 + i.price * i.qty, 0), 0);

  const ledgerMonth = data.pointsLedger.filter((p) => p.date.slice(0, 7) === month);
  const issued = ledgerMonth.filter((p) => p.points > 0).reduce((s, p) => s + p.points, 0);
  const redeemed = ledgerMonth.filter((p) => p.points < 0).reduce((s, p) => s + Math.abs(p.points), 0);

  return (
    <div>
      <PageHead title="Membership" sub={`${plan.name} · ${rupee(plan.price)}/${plan.validityDays}d · ${plan.serviceDiscountPct}% discount · ${plan.loyaltyMultiplier}× points`} />
      <div className="stat-grid">
        <StatCard label="Total Members" value={members.length} tone="ink" />
        <StatCard label="Active Members" value={active.length} tone="sage" />
        <StatCard label="Expiring Soon (≤15d)" value={expiringSoon.length} tone={expiringSoon.length ? "brick" : "sage"} />
        <StatCard label="Expired" value={expired.length} tone="brass" />
      </div>
      <div className="stat-grid">
        <StatCard label="New This Month" value={newThisMonth.length} tone="brass" />
        <StatCard label="Renewals This Month" value={renewalsThisMonth.length} tone="brass" />
        <StatCard label="Membership Revenue" value={rupee(membershipRevenue)} tone="ink" />
        <StatCard label="Points Issued / Redeemed" value={`${issued} / ${redeemed}`} tone="sage" />
      </div>

      <SectionCard title="Membership Report">
        <table className="tbl">
          <thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Start</th><th>Expiry</th></tr></thead>
          <tbody>
            {members.length === 0 ? <tr><td colSpan="5"><Empty text="No memberships sold yet." /></td></tr> : members.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td><td>{c.membershipPlanName || plan.name}</td>
                <td>{isMemberActive(c) ? <span className="tag sage">Active</span> : <span className="tag brick">Expired</span>}</td>
                <td>{c.membershipStart}</td><td>{c.membershipExpiry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Loyalty Report (this month)">
        <table className="tbl">
          <thead><tr><th>Date</th><th>Customer</th><th>Reason</th><th>Points</th><th>Balance</th></tr></thead>
          <tbody>
            {ledgerMonth.length === 0 ? <tr><td colSpan="5"><Empty text="No points activity this month." /></td></tr> :
              [...ledgerMonth].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td><td>{p.customerName}</td><td>{p.reason}</td>
                  <td>{p.points > 0 ? "+" : ""}{p.points}</td><td>{p.balanceAfter}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsTab({ data, update, notify }) {
  const [draft, setDraft] = useState(() => structuredClone(data.settings));
  const [dirty, setDirty] = useState(false);
  const s = draft;
  const plan = draft.membershipPlan;
  const loyalty = draft.loyalty;

  const set = (field, val) => { setDraft((d) => ({ ...d, [field]: val })); setDirty(true); };
  const setPlan = (field, val) => { setDraft((d) => ({ ...d, membershipPlan: { ...d.membershipPlan, [field]: val } })); setDirty(true); };
  const setLoyalty = (field, val) => { setDraft((d) => ({ ...d, loyalty: { ...d.loyalty, [field]: val } })); setDirty(true); };
  const setCred = (role, field, val) => { setDraft((d) => ({ ...d, credentials: { ...d.credentials, [role]: { ...d.credentials[role], [field]: val } } })); setDirty(true); };

  const save = () => {
    update((d) => { d.settings = structuredClone(draft); });
    notify("Settings saved");
    setDirty(false);
  };
  const discard = () => { setDraft(structuredClone(data.settings)); setDirty(false); };

  return (
    <div>
      <PageHead title="Settings" sub="Salon profile, membership & staff access" />

      <SectionCard title="Salon profile">
        <div className="profile-head">
          <div className="profile-mark">{(s.salonName || "B").trim().charAt(0).toUpperCase()}</div>
          <div className="profile-head-text">
            <div className="profile-head-name">{s.salonName || "Your Salon"}</div>
            <div className="profile-head-sub">GST {s.gst}% · Receipt #{s.nextBillNo} is next</div>
          </div>
        </div>
        <div className="settings-grid">
          <div>
            <label className="field-label">Salon name</label>
            <input value={s.salonName} onChange={(e) => set("salonName", e.target.value)} />
          </div>
          <div>
            <label className="field-label">GST %</label>
            <input type="number" value={s.gst} onChange={(e) => set("gst", Number(e.target.value))} />
          </div>
          <div>
            <label className="field-label">UPI ID (for payment QR codes)</label>
            <input placeholder="e.g. yoursalon@okhdfcbank" value={s.upiId} onChange={(e) => set("upiId", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Next receipt number</label>
            <input type="number" value={s.nextBillNo} onChange={(e) => set("nextBillNo", Number(e.target.value))} />
          </div>
          <div className="settings-grid-full">
            <label className="field-label">Receipt footer</label>
            <input value={s.footer} onChange={(e) => set("footer", e.target.value)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Membership plan">
        <div className="empty" style={{ marginBottom: 14 }}>These values drive every membership sold in Billing — change them anytime, existing members keep the terms they signed up under.</div>
        <div className="settings-grid">
          <div className="settings-grid-full">
            <label className="field-label">Plan name</label>
            <input value={plan.name} onChange={(e) => setPlan("name", e.target.value)} />
          </div>
          <div><label className="field-label">Price (₹)</label><input type="number" value={plan.price} onChange={(e) => setPlan("price", Number(e.target.value))} /></div>
          <div><label className="field-label">Validity (days)</label><input type="number" value={plan.validityDays} onChange={(e) => setPlan("validityDays", Number(e.target.value))} /></div>
          <div><label className="field-label">Service discount %</label><input type="number" value={plan.serviceDiscountPct} onChange={(e) => setPlan("serviceDiscountPct", Number(e.target.value))} /></div>
          <div><label className="field-label">Product discount %</label><input type="number" value={plan.productDiscountPct} onChange={(e) => setPlan("productDiscountPct", Number(e.target.value))} /></div>
          <div><label className="field-label">Loyalty multiplier (×)</label><input type="number" value={plan.loyaltyMultiplier} onChange={(e) => setPlan("loyaltyMultiplier", Number(e.target.value))} /></div>
          <div><label className="field-label">Birthday discount (₹)</label><input type="number" value={plan.birthdayDiscount} onChange={(e) => setPlan("birthdayDiscount", Number(e.target.value))} /></div>
        </div>
        <label className={"membership-toggle" + (plan.priorityBooking ? " on" : "")} style={{ marginTop: 8 }}>
          <input type="checkbox" checked={plan.priorityBooking} onChange={(e) => setPlan("priorityBooking", e.target.checked)} />
          <span>Priority booking for members</span>
        </label>
        <label className={"membership-toggle" + (plan.memberOnlyOffers ? " on" : "")}>
          <input type="checkbox" checked={plan.memberOnlyOffers} onChange={(e) => setPlan("memberOnlyOffers", e.target.checked)} />
          <span>Member-only offers</span>
        </label>
      </SectionCard>

      <SectionCard title="Loyalty points rules">
        <div className="settings-grid">
          <div><label className="field-label">Regular: points per ₹100 spent</label><input type="number" value={loyalty.pointsPer100} onChange={(e) => setLoyalty("pointsPer100", Number(e.target.value))} /></div>
          <div><label className="field-label">Redemption: points per ₹1</label><input type="number" value={loyalty.redemptionPointsPerRupee} onChange={(e) => setLoyalty("redemptionPointsPerRupee", Number(e.target.value))} /></div>
          <div><label className="field-label">Minimum redemption (points)</label><input type="number" value={loyalty.minRedemption} onChange={(e) => setLoyalty("minRedemption", Number(e.target.value))} /></div>
          <div><label className="field-label">Max redemption (% of bill)</label><input type="number" value={loyalty.maxRedemptionPct} onChange={(e) => setLoyalty("maxRedemptionPct", Number(e.target.value))} /></div>
        </div>
        <div className="empty" style={{ marginTop: 4 }}>Members earn {loyalty.pointsPer100 * plan.loyaltyMultiplier} points per ₹100 (regular customers earn {loyalty.pointsPer100}). {loyalty.redemptionPointsPerRupee} points = ₹1.</div>
      </SectionCard>

      <SectionCard title="Staff Logins">
        <div className="empty" style={{ marginBottom: 14 }}>Set the username and password each role uses to sign in. Share these with the relevant staff — anyone signing in with these credentials gets that role's access.</div>
        {["Admin", "Reception", "Stylist"].map((r) => (
          <div key={r} className="login-row">
            <div className="login-row-label">{r}</div>
            <input placeholder="Username" value={s.credentials[r].username} onChange={(e) => setCred(r, "username", e.target.value)} />
            <input placeholder="Password" value={s.credentials[r].password} onChange={(e) => setCred(r, "password", e.target.value)} />
          </div>
        ))}
      </SectionCard>

      {dirty && (
        <div className="save-bar">
          <span>You have unsaved changes.</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-ghost" onClick={discard}>Discard</button>
            <button className="btn-primary" onClick={save}>Save Changes</button>
          </div>
        </div>
      )}
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

function CustomerPicker({ customers, value, onChange, placeholder }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value);
  const filtered = query
    ? customers.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone || "").includes(query))
    : customers;
  const displayValue = open ? query : (selected ? `${selected.name}${selected.id !== "walkin" && selected.phone && selected.phone !== "-" ? ` — ${selected.phone}` : ""}` : "");
  return (
    <div className="cust-picker">
      <input
        placeholder={placeholder || "Search customer by name or phone"}
        value={displayValue}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div className="cust-picker-list">
          {filtered.length === 0 ? <div className="cust-picker-empty">No matches</div> : filtered.map((c) => (
            <div key={c.id} className="cust-picker-item" onMouseDown={() => { onChange(c.id); setOpen(false); setQuery(""); }}>
              {c.name}{c.id !== "walkin" && c.phone && c.phone !== "-" ? ` — ${c.phone}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

function CustomerModal({ onClose, onSave, initial }) {
  const [f, setF] = useState(initial ? { ...initial } : { name: "", phone: "", birthday: "", gender: "", notes: "", allergies: "", loyaltyPoints: 0, membershipId: "", membershipStart: "", membershipExpiry: "", birthdayBenefitUsedYear: null });
  const isValid = f.name.trim().length > 0 && f.phone.trim().length >= 4 && f.gender;
  const status = initial ? membershipStatusLabel(initial) : "None";
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

      {initial && (
        <div className="qr-note" style={{ textAlign: "left" }}>
          Membership: {status}{status !== "None" ? ` (${initial.membershipExpiry})` : ""} — sell or renew membership from the Billing screen.
        </div>
      )}
    </ModalShell>
  );
}

function AppointmentModal({ data, onClose, onSave, onQuickAddCustomer }) {
  const bookableCustomers = data.customers.filter((c) => c.id !== "walkin");
  const [f, setF] = useState({
    date: todayISO(), time: "09:00",
    customerId: bookableCustomers[0]?.id || "",
    service: data.services[0]?.name || "", stylist: data.employees[0]?.name || "",
  });
  const [showNew, setShowNew] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", phone: "", gender: "" });

  const noServices = data.services.length === 0;
  const noStaff = data.employees.length === 0;
  const noCustomers = bookableCustomers.length === 0;
  const selectedCustomer = bookableCustomers.find((c) => c.id === f.customerId);
  const isValid = f.date && f.time && selectedCustomer && f.service && f.stylist;

  const addAndSelect = () => {
    if (!newCust.name.trim() || !newCust.phone.trim() || !newCust.gender) return;
    const id = onQuickAddCustomer(newCust);
    setF({ ...f, customerId: id });
    setShowNew(false);
    setNewCust({ name: "", phone: "", gender: "" });
  };

  return (
    <ModalShell
      title="New Appointment"
      onClose={onClose}
      onSave={() => isValid && onSave({ date: f.date, time: f.time, customer: selectedCustomer.name, service: f.service, stylist: f.stylist })}
      disabled={!isValid}
      hint={noServices ? "Add a service first (Services tab)." : noStaff ? "Add an employee first (Employees tab)." : "Date, time, customer, service and stylist are all required."}
    >
      <label className="field-label">Date <span className="req">*</span></label>
      <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />

      <label className="field-label">Time <span className="req">*</span></label>
      <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />

      <label className="field-label">Customer <span className="req">*</span></label>
      {!showNew ? (
        <>
          {noCustomers ? (
            <div className="qr-note" style={{ marginBottom: 10 }}>No customers yet — add one below.</div>
          ) : (
            <CustomerPicker customers={bookableCustomers} value={f.customerId} onChange={(id) => setF({ ...f, customerId: id })} />
          )}
          <button type="button" className="btn-ghost" style={{ marginTop: 8, marginBottom: 12 }} onClick={() => setShowNew(true)}><Plus size={13} />New customer</button>
        </>
      ) : (
        <div className="inline-new-customer">
          <input placeholder="Name" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
          <input placeholder="Mobile number" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
          <select value={newCust.gender} onChange={(e) => setNewCust({ ...newCust, gender: e.target.value })}>
            <option value="">Select gender…</option>
            <option>Female</option><option>Male</option><option>Other</option>
          </select>
          <div className="row-2">
            <button type="button" className="btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={!newCust.name.trim() || !newCust.phone.trim() || !newCust.gender} onClick={addAndSelect}>Add & Select</button>
          </div>
        </div>
      )}

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

function ExpenseModal({ onClose, onSave, initial }) {
  const [f, setF] = useState(initial ? { ...initial } : { date: todayISO(), category: "Electricity", amount: "", note: "" });
  const isValid = Number(f.amount) > 0;
  return (
    <ModalShell title={initial ? "Edit Expense" : "New Expense"} onClose={onClose} onSave={() => isValid && onSave({ ...f, amount: Number(f.amount) })} disabled={!isValid} hint="Amount is required.">
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
      .member-banner { display:flex; flex-direction:column; gap:2px; background:var(--wine-soft); border:1px solid var(--gold); border-radius:8px; padding:9px 12px; font-family:var(--font-ui); font-size:12.5px; font-weight:600; color:var(--wine-deep); margin:10px 0; }
      .member-banner svg { display:inline; vertical-align:-2px; margin-right:4px; }
      .member-banner-sub { font-size:10.5px; font-weight:500; color:var(--ink-soft); }
      .loyalty-box { background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:10px 12px; margin:10px 0; font-family:var(--font-ui); }
      .loyalty-box-head { font-size:12px; margin-bottom:8px; color:var(--wine-deep); }
      .bs-line.member-line { color:var(--wine-deep); font-weight:600; }
      .mini-card { background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:10px 12px; margin:8px 0; font-family:var(--font-ui); }
      .mini-card-title { font-weight:700; font-size:11.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--wine-deep); margin-bottom:6px; }
      .detail-row.expiring { color:var(--rust); font-weight:600; }
      .badge-expired { background:var(--line); color:var(--ink-soft); }
      .adjust-row { display:flex; gap:6px; margin:8px 0; flex-wrap:wrap; }
      .adjust-row input { flex:1; min-width:80px; padding:7px 9px; border:1px solid var(--line); border-radius:6px; font-size:12px; font-family:var(--font-ui); }
      .settings-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px 14px; align-items:start; }
      .settings-grid > div { display:flex; flex-direction:column; }
      .settings-grid-full { grid-column:1 / -1; display:flex; flex-direction:column; }
      .section-card input:not([type="checkbox"]), .section-card select, .section-card textarea { width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid var(--line); border-radius:8px; font-family:var(--font-ui); font-size:13px; background:var(--paper); }
      .section-card .login-row input { padding:8px 10px; border-radius:7px; font-size:12.5px; }
      .save-bar { position:sticky; bottom:16px; margin-top:20px; background:var(--wine-deep); color:var(--cream); border-radius:12px; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; font-family:var(--font-ui); font-size:13px; box-shadow:0 12px 30px rgba(42,34,38,.3); z-index:10; }
      .save-bar .btn-primary { background:var(--gold); color:var(--wine-deep); }
      .save-bar .btn-ghost { color:var(--cream); border-color:rgba(248,244,238,.35); }
      .save-bar .btn-ghost:hover { background:rgba(248,244,238,.12); }
      .cust-picker { position:relative; }
      .cust-picker-list { position:absolute; top:calc(100% + 4px); left:0; right:0; background:var(--paper); border:1px solid var(--line); border-radius:8px; max-height:220px; overflow-y:auto; z-index:30; box-shadow:0 12px 30px rgba(42,34,38,.18); }
      .cust-picker-item { padding:9px 12px; font-family:var(--font-ui); font-size:12.5px; cursor:pointer; }
      .cust-picker-item:hover { background:var(--wine-soft); }
      .cust-picker-empty { padding:9px 12px; font-family:var(--font-ui); font-size:12px; color:var(--ink-soft); font-style:italic; }
      .reports-controls { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .reports-controls select, .reports-controls input { padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:var(--paper); font-family:var(--font-ui); font-size:12.5px; }
      .reports-controls .btn-primary { padding:8px 14px; white-space:nowrap; }
      .birthday-list { display:flex; flex-direction:column; gap:6px; }
      .birthday-row { display:flex; justify-content:space-between; align-items:center; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:9px 13px; font-family:var(--font-ui); }
      .birthday-name { font-size:13px; font-weight:600; }
      .birthday-date { font-size:11px; color:var(--ink-soft); }
      .inline-new-customer { background:var(--wine-soft); border:1px solid var(--gold); border-radius:8px; padding:12px; margin-bottom:12px; }
      .inline-new-customer input, .inline-new-customer select { margin-bottom:8px; }
      .profile-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid var(--line); }
      .profile-mark { width:44px; height:44px; border-radius:50%; background:var(--wine); color:var(--cream); font-family:var(--font-display); font-size:19px; font-weight:600; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .profile-head-name { font-family:var(--font-display); font-size:16px; font-weight:600; color:var(--wine-deep); }
      .profile-head-sub { font-family:var(--font-ui); font-size:11.5px; color:var(--ink-soft); margin-top:2px; }
      .login-row input { min-width:0; }
      @media print {
        body * { visibility:hidden; }
        #print-area, #print-area * { visibility:visible; }
        .modal-backdrop { position:static !important; background:none !important; inset:auto !important; display:block !important; }
        .modal { position:static !important; box-shadow:none !important; width:auto !important; max-width:320px !important; max-height:none !important; padding:0 !important; margin:0 auto !important; }
        #print-area { position:static !important; margin:0 auto; }
      }
      @media (max-width: 900px) {
        .app-shell { flex-direction:column; }
        .sidebar { width:100%; flex-direction:row; align-items:center; overflow-x:auto; }
        .nav { flex-direction:row; }
        .stat-grid, .reports-grid, .cust-grid, .emp-grid, .service-check-grid, .settings-grid { grid-template-columns:1fr; }
        .billing-grid { grid-template-columns:1fr; }
      }
    `}</style>
  );
}
