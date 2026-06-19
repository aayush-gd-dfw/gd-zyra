import { useState, useEffect } from "react";
import { api } from "../api";

// All 9 rule combinations: rows = customer_type, cols = customer_status
const RULES_GRID = [
  { rowLabel: "🚗 Auto",    colLabel: "New",      customer_type: "Auto",   customer_status: "New" },
  { rowLabel: "🚗 Auto",    colLabel: "Existing",  customer_type: "Auto",   customer_status: "Existing" },
  { rowLabel: "🚗 Auto",    colLabel: "Any Status",customer_type: "Auto",   customer_status: null },
  { rowLabel: "🏠 Retail",  colLabel: "New",       customer_type: "Retail", customer_status: "New" },
  { rowLabel: "🏠 Retail",  colLabel: "Existing",  customer_type: "Retail", customer_status: "Existing" },
  { rowLabel: "🏠 Retail",  colLabel: "Any Status",customer_type: "Retail", customer_status: null },
  { rowLabel: "Any Type",   colLabel: "New",       customer_type: null,     customer_status: "New" },
  { rowLabel: "Any Type",   colLabel: "Existing",  customer_type: null,     customer_status: "Existing" },
  { rowLabel: "Any Type",   colLabel: "Any Status",customer_type: null,     customer_status: null },
];

const ROWS = ["🚗 Auto", "🏠 Retail", "Any Type"];
const COLS = ["New", "Existing", "Any Status"];

// Returns the RULES_GRID cell matching a row and col label
function findCell(rowLabel, colLabel) {
  return RULES_GRID.find(c => c.rowLabel === rowLabel && c.colLabel === colLabel);
}

// Returns the rule from rules array matching a cell's type/status
function findRule(rules, cell) {
  return rules.find(
    r => r.customer_type === cell.customer_type && r.customer_status === cell.customer_status
  );
}

const PURPLE = "#7c3aed";

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState({}); // key = "type:status" -> true
  const [flash, setFlash] = useState({}); // key -> "saved" | "error"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.listRules(), api.listRuleEmployees()])
      .then(([r, e]) => {
        setRules(r || []);
        setEmployees(e || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cellKey = (cell) =>
    `${cell.customer_type ?? "null"}:${cell.customer_status ?? "null"}`;

  const handleChange = async (cell, employeeId) => {
    const key = cellKey(cell);
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const updated = await api.upsertRule(
        cell.customer_type,
        cell.customer_status,
        employeeId || null
      );
      setRules(updated || []);
      setFlash(f => ({ ...f, [key]: "saved" }));
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[key]; return n; }), 2000);
    } catch (err) {
      console.error(err);
      setFlash(f => ({ ...f, [key]: "error" }));
      setTimeout(() => setFlash(f => { const n = { ...f }; delete n[key]; return n; }), 3000);
    } finally {
      setSaving(s => { const n = { ...s }; delete n[key]; return n; });
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>
        Loading rules…
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{
        background: PURPLE, color: "#fff", borderRadius: 12,
        padding: "18px 24px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
          ⚙ Assignment Rules
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Configure who automatically receives each call type
        </div>
      </div>

      {/* Grid table */}
      <div style={{
        background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.08)",
        overflow: "hidden", border: "1px solid #e5e7eb",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={th}></th>
              {COLS.map(col => (
                <th key={col} style={{ ...th, color: PURPLE, fontWeight: 700 }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, ri) => (
              <tr key={row} style={{ background: ri % 2 === 0 ? "#fff" : "#faf5ff" }}>
                <td style={{ ...td, fontWeight: 700, color: "#374151", width: 120 }}>{row}</td>
                {COLS.map(col => {
                  const cell = findCell(row, col);
                  const rule = findRule(rules, cell);
                  const key = cellKey(cell);
                  const isSaving = saving[key];
                  const flashState = flash[key];
                  const currentEmpId = rule?.employee_id || "";

                  return (
                    <td key={col} style={td}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <select
                          value={currentEmpId}
                          disabled={isSaving}
                          onChange={e => handleChange(cell, e.target.value || null)}
                          style={{
                            width: "100%", padding: "7px 10px", borderRadius: 7,
                            border: `1px solid ${flashState === "error" ? "#ef4444" : "#d1d5db"}`,
                            fontSize: 13, background: "#fff", cursor: "pointer",
                            outline: "none",
                            opacity: isSaving ? 0.6 : 1,
                          }}
                        >
                          <option value="">— Unassigned —</option>
                          {employees.map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                        {flashState === "saved" && (
                          <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>
                            Saved ✓
                          </span>
                        )}
                        {flashState === "error" && (
                          <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
                            Error saving
                          </span>
                        )}
                        {isSaving && (
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>Saving…</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fallback note */}
      <div style={{
        marginTop: 18, padding: "12px 16px",
        background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8,
        fontSize: 13, color: "#5b21b6", lineHeight: 1.6,
      }}>
        <strong>How matching works:</strong> Exact match (type + status) wins. If none, type-only
        or status-only rules apply. The <em>Any Type / Any Status</em> row is the global fallback
        for all unmatched calls.
        <br />
        These rules auto-assign new incoming calls. You can still reassign any call manually.
      </div>
    </div>
  );
}

const th = {
  padding: "12px 14px",
  textAlign: "left",
  fontSize: 13,
  color: "#6b7280",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 600,
};

const td = {
  padding: "10px 14px",
  verticalAlign: "middle",
  borderBottom: "1px solid #f3f4f6",
  fontSize: 13,
};
