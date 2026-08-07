import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, CalendarDays, Receipt, Users, Package,
  Briefcase, Wallet, BarChart3, Settings as SettingsIcon,
  Plus, X, Printer, Search, TrendingUp, AlertTriangle, Scissors
} from "lucide-react";

const STORAGE_KEY = "beige-salon-data-v1";

// Standalone browser storage (works on any deployed site — no backend needed).
// Note: this saves data per-device/browser. If you want every tablet, phone,
// and computer at the salon to share the SAME live data, swap this for a
// backend like Supabase — ask Claude to wire that in when you're ready.
const storage = {
  async get(key) {
    const v = localStorage.getItem(key);
    return v !== null ? { key, value: v } : null;
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
};

const seed = {
  settings: { salonName: "Beige Unisex Salon", gst: 5, footer: "Thank you for visiting!", role: "Admin" },
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
    { id: "c1", name: "Sneha", phone: "9876543210", birthday: "1996-07-15", gender: "Female", notes: "", allergies: "", membership: "", loyaltyPoints: 12 },
    { id: "c2", name: "Priya", phone: "9876500011", birthday: "1992-03-02", gender: "Female", notes: "", allergies: "", membership: "Gold", loyaltyPoints: 40 },
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
function rupee(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
function uid(p) { return p + Math.random().toString(36).slice(2, 9); }

export default function App() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null); // {type, payload}
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        setData(res && res.value ? JSON.parse(res.value) : seed);
      } catch (e) {
        setData(seed);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    storage.set(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  const update = (fn) => setData((d) => { const nd = structuredClone(d); fn(nd); return nd; });

  if (!loaded || !data) {
    return <div className="app-shell"><Style /><div className="loading">Setting up the salon…</div></div>;
  }

  const role = data.settings.role;
  const tabsAll = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Reception", "Stylist"] },
    { id: "appointments", label: "Appointments", icon: CalendarDays, roles: ["Admin", "Reception", "Stylist"] },
    { id: "billing", label: "Billing", icon: Receipt, roles: ["Admin", "Reception"] },
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
          <label>Viewing as</label>
          <select value={role} onChange={(e) => update((d) => { d.settings.role = e.target.value; })}>
            <option>Admin</option>
            <option>Reception</option>
            <option>Stylist</option>
          </select>
        </div>
      </aside>

      <main className="main">
        {activeTab === "dashboard" && <Dashboard data={data} setTab={setTab} openModal={setModal} />}
        {activeTab === "appointments" && <Appointments data={data} update={update} openModal={setModal} />}
        {activeTab === "billing" && <Billing data={data} update={update} setReceipt={setReceipt} />}
        {activeTab === "customers" && <Customers data={data} update={update} openModal={setModal} />}
        {activeTab === "inventory" && <Inventory data={data} update={update} openModal={setModal} />}
        {activeTab === "services" && <Services data={data} update={update} openModal={setModal} />}
        {activeTab === "employees" && <Employees data={data} update={update} openModal={setModal} />}
        {activeTab === "expenses" && <Expenses data={data} update={update} openModal={setModal} />}
        {activeTab === "reports" && <Reports data={data} />}
        {activeTab === "settings" && <SettingsTab data={data} update={update} />}
      </main>

      {modal?.type === "newCustomer" && <CustomerModal onClose={() => setModal(null)} onSave={(c) => { update((d) => d.customers.push({ ...c, id: uid("c") })); setModal(null); }} />}
      {modal?.type === "newAppointment" && <AppointmentModal data={data} onClose={() => setModal(null)} onSave={(a) => { update((d) => d.appointments.push({ ...a, id: uid("a"), status: "pending" })); setModal(null); }} />}
      {modal?.type === "newExpense" && <ExpenseModal onClose={() => setModal(null)} onSave={(e) => { update((d) => d.expenses.push({ ...e, id: uid("x") })); setModal(null); }} />}
      {modal?.type === "newProduct" && <ProductModal services={data.services} onClose={() => setModal(null)} onSave={(p) => { update((d) => d.inventory.push({ ...p, id: uid("p") })); setModal(null); }} />}
      {modal?.type === "newEmployee" && <EmployeeModal onClose={() => setModal(null)} onSave={(e) => { update((d) => d.employees.push({ ...e, id: uid("e") })); setModal(null); }} />}
      {modal?.type === "newService" && <ServiceModal onClose={() => setModal(null)} onSave={(s) => { update((d) => d.services.push({ ...s, id: uid("s") })); setModal(null); }} />}
      {receipt && <ReceiptModal receipt={receipt} settings={data.settings} onClose={() => setReceipt(null)} />}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
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
        <button className="qa" onClick={() => openModal({ type: "newAppointment" })}><Plus size={15} />New Appointment</button>
        <button className="qa" onClick={() => setTab("billing")}><Plus size={15} />New Bill</button>
        <button className="qa" onClick={() => openModal({ type: "newCustomer" })}><Plus size={15} />New Customer</button>
        <button className="qa" onClick={() => openModal({ type: "newExpense" })}><Plus size={15} />Expenses</button>
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
function Appointments({ data, update, openModal }) {
  const [filterDate, setFilterDate] = useState(todayISO());
  const [filterStylist, setFilterStylist] = useState("");
  const list = data.appointments
    .filter((a) => (filterDate ? a.date === filterDate : true))
    .filter((a) => (filterStylist ? a.stylist === filterStylist : true))
    .sort((a, b) => a.time.localeCompare(b.time));

  const toggleStatus = (id) => update((d) => {
    const a = d.appointments.find((x) => x.id === id);
    a.status = a.status === "done" ? "pending" : "done";
  });
  const remove = (id) => update((d) => { d.appointments = d.appointments.filter((x) => x.id !== id); });

  return (
    <div>
      <PageHead title="Appointments" sub="Today's schedule and bookings" action={
        <button className="btn-primary" onClick={() => openModal({ type: "newAppointment" })}><Plus size={15} />New Appointment</button>
      } />
      <div className="filter-row">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        <select value={filterStylist} onChange={(e) => setFilterStylist(e.target.value)}>
          <option value="">All stylists</option>
          {data.employees.map((e) => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
      </div>
      <div className="appt-list">
        {list.length === 0 ? <Empty text="No appointments match these filters." /> : list.map((a) => (
          <div key={a.id} className={"appt-row" + (a.status === "done" ? " done" : "")}>
            <div className="appt-time">{a.time}</div>
            <div className="appt-body">
              <div className="appt-cust">{a.customer}</div>
              <div className="appt-meta">{a.service} · {a.stylist}</div>
            </div>
            <button className="btn-ghost" onClick={() => toggleStatus(a.id)}>{a.status === "done" ? "Done" : "Mark done"}</button>
            <button className="btn-ghost danger" onClick={() => remove(a.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Billing ---------------- */
function Billing({ data, update, setReceipt }) {
  const [customerName, setCustomerName] = useState("");
  const [selected, setSelected] = useState({}); // serviceId -> qty
  const [products, setProducts] = useState({}); // productId -> qty
  const [staff, setStaff] = useState(data.employees[0]?.name || "");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState("Cash");
  const [stockWarning, setStockWarning] = useState("");

  const retailProducts = data.inventory.filter((p) => p.retail !== false);

  const serviceItems = data.services.filter((s) => selected[s.id] > 0)
    .map((s) => ({ type: "service", name: s.name, price: s.price, qty: selected[s.id] }));
  const productItems = retailProducts.filter((p) => products[p.id] > 0)
    .map((p) => ({ type: "product", name: p.name, price: p.sellingPrice, qty: products[p.id] }));
  const items = [...serviceItems, ...productItems];

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
    if (items.length === 0) return;
    const bill = {
      id: uid("b"), date: todayISO(), customer: customerName || "Walk-in",
      items, discount: Number(discount) || 0, gst: gstAmt, subtotal, total,
      paymentMethod: payment, staff,
    };
    update((d) => {
      d.bills.push(bill);
      const earned = Math.floor(total / 100);
      const cust = d.customers.find((c) => c.name === bill.customer);
      if (cust) cust.loyaltyPoints = (cust.loyaltyPoints || 0) + earned;

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
    setCustomerName(""); setSelected({}); setProducts({}); setDiscount(0);
  };

  return (
    <div>
      <PageHead title="Billing" sub="Create a new bill" />
      <div className="billing-grid">
        <div className="billing-left">
          <label className="field-label">Customer</label>
          <input list="cust-list" placeholder="Search or type customer name (blank = Walk-in)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <datalist id="cust-list">{data.customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>

          <label className="field-label">Choose services</label>
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

          <label className="field-label">Staff</label>
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
            <button className="btn-primary full" disabled={items.length === 0} onClick={generate}>Generate Bill</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptModal({ receipt, settings, onClose }) {
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
          <div className="receipt-footer">{settings.footer}</div>
        </div>
        <button className="btn-primary full" onClick={() => window.print()}><Printer size={15} />Print</button>
      </div>
    </div>
  );
}

/* ---------------- Customers ---------------- */
function Customers({ data, update, openModal }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const list = data.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  return (
    <div>
      <PageHead title="Customers" sub={`${data.customers.length} profiles`} action={
        <button className="btn-primary" onClick={() => openModal({ type: "newCustomer" })}><Plus size={15} />New Customer</button>
      } />
      <div className="search-row"><Search size={15} /><input placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="cust-grid">
        {list.map((c) => (
          <div key={c.id} className="cust-card" onClick={() => setOpen(open === c.id ? null : c.id)}>
            <div className="cust-top">
              <div className="cust-name">{c.name} {c.membership && <span className="badge">{c.membership}</span>}</div>
              <div className="cust-phone">{c.phone}</div>
            </div>
            <div className="cust-meta">{c.loyaltyPoints || 0} pts · {c.gender}</div>
            {open === c.id && (
              <div className="cust-detail">
                {c.allergies && <div className="detail-row"><b>Allergies:</b> {c.allergies}</div>}
                {c.notes && <div className="detail-row"><b>Notes:</b> {c.notes}</div>}
                <div className="detail-row"><b>Birthday:</b> {c.birthday || "—"}</div>
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
function Inventory({ data, update, openModal }) {
  const adjust = (id, delta) => update((d) => {
    const p = d.inventory.find((x) => x.id === id);
    p.stock = Math.max(0, p.stock + delta);
  });
  return (
    <div>
      <PageHead title="Inventory" sub="Retail & salon-use products" action={
        <button className="btn-primary" onClick={() => openModal({ type: "newProduct" })}><Plus size={15} />New Product</button>
      } />
      <table className="tbl">
        <thead><tr><th>Product</th><th>Type</th><th>Supplier</th><th>Stock</th><th>Min</th><th>Purchase</th><th>Selling</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {data.inventory.map((p) => (
            <tr key={p.id} className={p.stock <= p.min ? "low" : ""}>
              <td>{p.name}</td>
              <td>{p.retail !== false ? "Retail" : (p.linkedService ? `Auto: -${p.usagePerService}/${p.linkedService}` : "Salon-use")}</td>
              <td>{p.supplier}</td><td>{p.stock}</td><td>{p.min}</td>
              <td>{rupee(p.purchasePrice)}</td><td>{rupee(p.sellingPrice)}</td>
              <td>{p.stock <= p.min ? <span className="tag brick"><AlertTriangle size={12} />Low stock</span> : <span className="tag sage">OK</span>}</td>
              <td className="stock-btns"><button onClick={() => adjust(p.id, -1)}>−</button><button onClick={() => adjust(p.id, 1)}>+</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="empty" style={{ marginTop: 10 }}>Retail products can be sold directly on a bill and their stock drops automatically. Salon-use products (marked "Auto") deplete on their own whenever the linked service is billed — set this up when adding a product.</div>
    </div>
  );
}

/* ---------------- Services ---------------- */
function Services({ data, update, openModal }) {
  const editPrice = (id, field, val) => update((d) => { d.services.find((s) => s.id === id)[field] = Number(val); });
  return (
    <div>
      <PageHead title="Services" sub="Menu, pricing & commission" action={
        <button className="btn-primary" onClick={() => openModal({ type: "newService" })}><Plus size={15} />New Service</button>
      } />
      <table className="tbl">
        <thead><tr><th>Service</th><th>Price</th><th>Duration (min)</th><th>Commission %</th></tr></thead>
        <tbody>
          {data.services.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td><input className="cell-input" type="number" value={s.price} onChange={(e) => editPrice(s.id, "price", e.target.value)} /></td>
              <td><input className="cell-input" type="number" value={s.duration} onChange={(e) => editPrice(s.id, "duration", e.target.value)} /></td>
              <td><input className="cell-input" type="number" value={s.commission} onChange={(e) => editPrice(s.id, "commission", e.target.value)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Employees ---------------- */
function Employees({ data, openModal }) {
  const commissionFor = (emp) => data.bills.filter((b) => b.staff === emp.name)
    .reduce((sum, b) => sum + Math.round(b.total * (emp.commissionPct / 100)), 0);
  const revenueFor = (emp) => data.bills.filter((b) => b.staff === emp.name).reduce((s, b) => s + b.total, 0);
  const clientsFor = (emp) => new Set(data.bills.filter((b) => b.staff === emp.name).map((b) => b.customer)).size;

  return (
    <div>
      <PageHead title="Employees" sub="Team & commission" action={
        <button className="btn-primary" onClick={() => openModal({ type: "newEmployee" })}><Plus size={15} />New Employee</button>
      } />
      <div className="emp-grid">
        {data.employees.map((e) => (
          <div key={e.id} className="emp-card">
            <div className="emp-name">{e.name}</div>
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
        <button className="btn-primary" onClick={() => openModal({ type: "newExpense" })}><Plus size={15} />New Expense</button>
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

function ModalShell({ title, onClose, children, onSave, saveLabel = "Save" }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><button className="modal-close" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">{children}</div>
        <button className="btn-primary full" onClick={onSave}>{saveLabel}</button>
      </div>
    </div>
  );
}

function CustomerModal({ onClose, onSave }) {
  const [f, setF] = useState({ name: "", phone: "", birthday: "", gender: "Female", notes: "", allergies: "", membership: "", loyaltyPoints: 0 });
  return (
    <ModalShell title="New Customer" onClose={onClose} onSave={() => f.name && onSave(f)}>
      <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input placeholder="Mobile number" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <input type="date" value={f.birthday} onChange={(e) => setF({ ...f, birthday: e.target.value })} />
      <select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
        <option>Female</option><option>Male</option><option>Other</option>
      </select>
      <input placeholder="Allergies (optional)" value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} />
      <textarea placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
    </ModalShell>
  );
}

function AppointmentModal({ data, onClose, onSave }) {
  const [f, setF] = useState({ date: todayISO(), time: "09:00", customer: "", service: data.services[0]?.name || "", stylist: data.employees[0]?.name || "" });
  return (
    <ModalShell title="New Appointment" onClose={onClose} onSave={() => onSave(f)}>
      <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
      <input list="cust-list-2" placeholder="Customer name (blank = Walk-in)" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
      <datalist id="cust-list-2">{data.customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      <select value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>
        {data.services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
      <select value={f.stylist} onChange={(e) => setF({ ...f, stylist: e.target.value })}>
        {data.employees.map((e2) => <option key={e2.id} value={e2.name}>{e2.name}</option>)}
      </select>
    </ModalShell>
  );
}

function ExpenseModal({ onClose, onSave }) {
  const [f, setF] = useState({ date: todayISO(), category: "Electricity", amount: "", note: "" });
  return (
    <ModalShell title="New Expense" onClose={onClose} onSave={() => f.amount && onSave({ ...f, amount: Number(f.amount) })}>
      <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
        {["Electricity", "Rent", "Products", "Marketing", "Tea/Coffee", "Repairs", "Other"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <input type="number" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      <input placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
    </ModalShell>
  );
}

function ProductModal({ onClose, onSave, services }) {
  const [f, setF] = useState({ name: "", stock: 0, min: 5, supplier: "", purchasePrice: 0, sellingPrice: 0, retail: true, linkedService: "", usagePerService: 1 });
  return (
    <ModalShell title="New Product" onClose={onClose} onSave={() => f.name && onSave(f)}>
      <input placeholder="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input placeholder="Supplier" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} />
      <div className="row-2">
        <input type="number" placeholder="Stock" value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} />
        <input type="number" placeholder="Minimum" value={f.min} onChange={(e) => setF({ ...f, min: Number(e.target.value) })} />
      </div>
      <div className="row-2">
        <input type="number" placeholder="Purchase price" value={f.purchasePrice} onChange={(e) => setF({ ...f, purchasePrice: Number(e.target.value) })} />
        <input type="number" placeholder="Selling price" value={f.sellingPrice} onChange={(e) => setF({ ...f, sellingPrice: Number(e.target.value) })} />
      </div>
      <label className="field-label">How does stock get used?</label>
      <select value={f.retail ? "retail" : "salon"} onChange={(e) => setF({ ...f, retail: e.target.value === "retail" })}>
        <option value="retail">Sold directly to customers (retail)</option>
        <option value="salon">Used during a service (salon-use)</option>
      </select>
      {!f.retail && (
        <div className="row-2">
          <select value={f.linkedService} onChange={(e) => setF({ ...f, linkedService: e.target.value })}>
            <option value="">Link to service…</option>
            {(services || []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <input type="number" min="0" step="0.1" placeholder="Used per service" value={f.usagePerService} onChange={(e) => setF({ ...f, usagePerService: Number(e.target.value) })} />
        </div>
      )}
    </ModalShell>
  );
}

function EmployeeModal({ onClose, onSave }) {
  const [f, setF] = useState({ name: "", role: "Stylist", phone: "", salary: 0, commissionPct: 20 });
  return (
    <ModalShell title="New Employee" onClose={onClose} onSave={() => f.name && onSave(f)}>
      <input placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input placeholder="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} />
      <input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <div className="row-2">
        <input type="number" placeholder="Salary" value={f.salary} onChange={(e) => setF({ ...f, salary: Number(e.target.value) })} />
        <input type="number" placeholder="Commission %" value={f.commissionPct} onChange={(e) => setF({ ...f, commissionPct: Number(e.target.value) })} />
      </div>
    </ModalShell>
  );
}

function ServiceModal({ onClose, onSave }) {
  const [f, setF] = useState({ name: "", price: 0, duration: 30, commission: 20 });
  return (
    <ModalShell title="New Service" onClose={onClose} onSave={() => f.name && onSave(f)}>
      <input placeholder="Service name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="row-2">
        <input type="number" placeholder="Price" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
        <input type="number" placeholder="Duration (min)" value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) })} />
      </div>
      <input type="number" placeholder="Commission %" value={f.commission} onChange={(e) => setF({ ...f, commission: Number(e.target.value) })} />
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
      .service-check { display:flex; align-items:center; gap:8px; background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:9px 11px; font-family:var(--font-ui); font-size:12.5px; cursor:pointer; transition:.15s; }
      .service-check.on { border-color:var(--gold); background:var(--wine-soft); }
      .sc-price { margin-left:auto; color:var(--ink-soft); font-size:11px; }
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
      @media (max-width: 900px) {
        .app-shell { flex-direction:column; }
        .sidebar { width:100%; flex-direction:row; align-items:center; overflow-x:auto; }
        .nav { flex-direction:row; }
        .stat-grid, .reports-grid, .cust-grid, .emp-grid { grid-template-columns:1fr; }
        .billing-grid { grid-template-columns:1fr; }
      }
    `}</style>
  );
}
