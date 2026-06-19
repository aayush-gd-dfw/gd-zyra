import { useState, useEffect } from "react";
import { api } from "../api";

const ROLE_LABELS = { employee: "Employee", manager: "Manager", admin: "Admin" };
const PURPLE = "#7c3aed";

const inputStyle = {
  width: "100%", padding: "8px 12px", borderRadius: 7,
  border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", outline: "none",
};
const selectStyle = { ...inputStyle, background: "#fff", cursor: "pointer" };

function Badge({ active }) {
  return (
    <span style={{
      background: active ? "#dcfce7" : "#f3f4f6",
      color: active ? "#166534" : "#9ca3af",
      padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
    }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 12, padding: "28px 32px", width: 460, boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#111827" }}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalButtons({ onClose, saving, saveLabel }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
      <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 13 }}>
        Cancel
      </button>
      <button type="submit" disabled={saving} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: PURPLE, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

function AddModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "", role: "employee" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setError("All fields are required."); return;
    }
    if (!form.email.includes("@")) { setError("Enter a valid email address."); return; }
    setSaving(true); setError("");
    try {
      onSaved(await api.createEmployee(form));
    } catch (ex) {
      setError(ex.message || "Failed to create user");
    } finally { setSaving(false); }
  };

  return (
    <Modal title="Add New User" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Full name">
          <input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Dakota Smith" />
        </Field>
        <Field label="Email address">
          <input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="dakota@example.com" />
        </Field>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="Username (login)">
              <input style={inputStyle} value={form.username} onChange={e => set("username", e.target.value)} placeholder="dakota" autoCapitalize="none" />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Password">
              <input style={inputStyle} type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min 6 chars" />
            </Field>
          </div>
        </div>
        <Field label="Role">
          <select style={selectStyle} value={form.role} onChange={e => set("role", e.target.value)}>
            <option value="employee">Employee — sees own calls only</option>
            <option value="manager">Manager — sees all calls + rules</option>
            <option value="admin">Admin — full access</option>
          </select>
        </Field>
        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <ModalButtons onClose={onClose} saving={saving} saveLabel="Create User" />
      </form>
    </Modal>
  );
}

function EditModal({ emp, onClose, onSaved }) {
  const [form, setForm] = useState({ name: emp.name, email: emp.email || "", role: emp.role, password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (form.email && !form.email.includes("@")) { setError("Enter a valid email address."); return; }
    setSaving(true); setError("");
    try {
      const body = { name: form.name, email: form.email, role: form.role };
      if (form.password.trim()) body.password = form.password.trim();
      onSaved(await api.updateEmployee(emp.id, body));
    } catch (ex) {
      setError(ex.message || "Failed to update");
    } finally { setSaving(false); }
  };

  return (
    <Modal title={`Edit — ${emp.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Full name">
          <input style={inputStyle} value={form.name} onChange={e => set("name", e.target.value)} />
        </Field>
        <Field label="Email address">
          <input style={inputStyle} type="email" value={form.email} onChange={e => set("email", e.target.value)} />
        </Field>
        <Field label="Role">
          <select style={selectStyle} value={form.role} onChange={e => set("role", e.target.value)}>
            <option value="employee">Employee — sees own calls only</option>
            <option value="manager">Manager — sees all calls + rules</option>
            <option value="admin">Admin — full access</option>
          </select>
        </Field>
        <Field label="New password (leave blank to keep current)">
          <input style={inputStyle} type="password" value={form.password} onChange={e => set("password", e.target.value)} placeholder="Leave blank to keep current" />
        </Field>
        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <ModalButtons onClose={onClose} saving={saving} saveLabel="Save Changes" />
      </form>
    </Modal>
  );
}

function Table({ employees, onEdit, onToggle, toggling }) {
  if (!employees.length) return null;
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", marginBottom: 4 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: "#faf5ff", borderBottom: "1px solid #e5e7eb" }}>
            <th style={th}>Name</th>
            <th style={th}>Email</th>
            <th style={th}>Username</th>
            <th style={th}>Role</th>
            <th style={th}>Status</th>
            <th style={{ ...th, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => (
            <tr key={emp.id} style={{ borderBottom: i < employees.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              <td style={td}>
                <span style={{ fontWeight: 600, color: "#111827" }}>👤 {emp.name}</span>
              </td>
              <td style={{ ...td, color: "#6b7280", fontSize: 13 }}>{emp.email || "—"}</td>
              <td style={{ ...td, color: "#6b7280", fontFamily: "monospace", fontSize: 13 }}>{emp.username}</td>
              <td style={td}>
                <span style={{
                  background: emp.role === "admin" ? "#fef3c7" : emp.role === "manager" ? "#ede9fe" : "#f3f4f6",
                  color: emp.role === "admin" ? "#92400e" : emp.role === "manager" ? "#5b21b6" : "#374151",
                  padding: "2px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                }}>
                  {ROLE_LABELS[emp.role] || emp.role}
                </span>
              </td>
              <td style={td}><Badge active={emp.is_active} /></td>
              <td style={{ ...td, textAlign: "right" }}>
                <button onClick={() => onEdit(emp)} style={{ ...actionBtn, marginRight: 6 }}>Edit</button>
                <button
                  onClick={() => onToggle(emp)}
                  disabled={toggling === emp.id}
                  style={{
                    ...actionBtn,
                    color: emp.is_active ? "#dc2626" : "#166534",
                    borderColor: emp.is_active ? "#fca5a5" : "#86efac",
                    background: emp.is_active ? "#fef2f2" : "#f0fdf4",
                  }}
                >
                  {toggling === emp.id ? "…" : emp.is_active ? "Deactivate" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toggling, setToggling] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setEmployees(await api.listAllEmployees()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSaved = (emp) => {
    setEmployees(prev => {
      const idx = prev.findIndex(e => e.id === emp.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = emp; return next; }
      return [...prev, emp];
    });
    setShowAdd(false);
    setEditing(null);
  };

  const toggleActive = async (emp) => {
    setToggling(emp.id);
    try {
      const updated = await api.updateEmployee(emp.id, { is_active: !emp.is_active });
      setEmployees(prev => prev.map(e => e.id === updated.id ? updated : e));
    } catch (ex) {
      alert(ex.message || "Failed to update");
    } finally { setToggling(null); }
  };

  const active   = employees.filter(e => e.is_active);
  const inactive = employees.filter(e => !e.is_active);

  return (
    <div style={{ padding: "32px 40px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>Team Members</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
            {active.length} active · {inactive.length} inactive — these are the same people available in assignment dropdowns
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Add User
        </button>
      </div>

      {loading
        ? <p style={{ color: "#9ca3af" }}>Loading…</p>
        : <>
            <Table employees={active} onEdit={setEditing} onToggle={toggleActive} toggling={toggling} />
            {inactive.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".06em", margin: "28px 0 10px" }}>
                  Inactive
                </div>
                <Table employees={inactive} onEdit={setEditing} onToggle={toggleActive} toggling={toggling} />
              </>
            )}
            {!loading && employees.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
                No users yet. Click <strong>+ Add User</strong> to create the first one.
              </div>
            )}
          </>
      }

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onSaved={handleSaved} />}
      {editing  && <EditModal emp={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </div>
  );
}

const th = { padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em" };
const td = { padding: "12px 16px", verticalAlign: "middle" };
const actionBtn = { padding: "5px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "#374151" };
