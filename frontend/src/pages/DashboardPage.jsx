import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import { format, isToday } from "date-fns";

function fmt(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    return isToday(dt) ? format(dt, "h:mm a") : format(dt, "MMM d, h:mm a");
  } catch { return d; }
}

const TYPE_STYLE = {
  Auto:   { background: "#dbeafe", color: "#1e40af", icon: "🚗" },
  Retail: { background: "#fce7f3", color: "#9d174d", icon: "🏠" },
};
const STATUS_STYLE = {
  New:      { background: "#dcfce7", color: "#166534", label: "✨ New" },
  Existing: { background: "#f3f4f6", color: "#374151", label: "Existing" },
};
const TASK_STATUS_STYLE = {
  "To Do":       { background: "#f3f4f6", color: "#374151", dot: "#9ca3af" },
  "In Progress": { background: "#fef3c7", color: "#92400e", dot: "#f59e0b" },
  "Complete":    { background: "#dcfce7", color: "#166534", dot: "#22c55e" },
};
const TASK_STATUSES = ["To Do", "In Progress", "Complete"];

function Badge({ type, value }) {
  const style = (type === "type" ? TYPE_STYLE : STATUS_STYLE)[value] || {};
  return (
    <span style={{
      ...style, padding: "3px 10px", borderRadius: 12,
      fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      {type === "type" && style.icon} {value || "—"}
    </span>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: "14px 16px",
      boxShadow: "0 1px 3px rgba(0,0,0,.08)", flex: 1, minWidth: 80,
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || "#111827" }}>{value ?? "—"}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CallRow({ call, selected, onClick }) {
  const ts = TYPE_STYLE[call.customer_type] || {};
  const ss = STATUS_STYLE[call.customer_status] || {};
  return (
    <div
      onClick={onClick}
      style={{
        padding: "11px 14px",
        borderBottom: "1px solid #f3f4f6",
        cursor: "pointer",
        background: selected ? "#f5f3ff" : "#fff",
        borderLeft: selected ? "3px solid #7c3aed" : "3px solid transparent",
        transition: "background .1s",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "#faf5ff"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "#fff"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" }}>
        {call.customer_type && (
          <span style={{ ...ts, padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
            {ts.icon} {call.customer_type}
          </span>
        )}
        {call.customer_status && (
          <span style={{ ...ss, padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700 }}>
            {ss.label}
          </span>
        )}
        {!call.ai_processed && (
          <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
            ⏳ Processing
          </span>
        )}
        {(() => {
          const ts = TASK_STATUS_STYLE[call.task_status] || TASK_STATUS_STYLE["To Do"];
          return (
            <span style={{ ...ts, padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ts.dot, display: "inline-block" }} />
              {call.task_status || "To Do"}
            </span>
          );
        })()}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>{fmt(call.received_at)}</span>
      </div>
      {call.customer_phone && (
        <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 2 }}>📞 {call.customer_phone}</div>
      )}
      {call.assigned_to_name && (
        <div style={{ fontSize: 11, color: "#7c3aed", marginBottom: 2 }}>👤 {call.assigned_to_name}</div>
      )}
      {call.summary && (
        <div style={{
          fontSize: 11, color: "#6b7280", lineHeight: 1.4,
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {call.summary}
        </div>
      )}
    </div>
  );
}

function AssignPicker({ call, employees, onAssigned }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const assign = async (empId) => {
    setSaving(true);
    setOpen(false);
    try {
      const updated = await api.assignCall(call.id, empId);
      onAssigned(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        style={{
          background: call.assigned_to_id ? "#ede9fe" : "#f3f4f6",
          color: call.assigned_to_id ? "#7c3aed" : "#6b7280",
          border: "1px solid " + (call.assigned_to_id ? "#c4b5fd" : "#d1d5db"),
          borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer",
          fontWeight: 500, display: "flex", alignItems: "center", gap: 6,
        }}
      >
        👤 {saving ? "Saving…" : (call.assigned_to_name || "Assign to…")}
        <span style={{ fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 100,
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,.12)", minWidth: 200, overflow: "hidden",
        }}>
          {call.assigned_to_id && (
            <div
              onClick={() => assign(null)}
              style={{ padding: "8px 14px", fontSize: 13, cursor: "pointer", color: "#dc2626",
                borderBottom: "1px solid #f3f4f6" }}
              onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
              onMouseLeave={e => e.currentTarget.style.background = ""}
            >
              ✕ Unassign
            </div>
          )}
          {employees.map(e => (
            <div
              key={e.id}
              onClick={() => assign(e.id)}
              style={{
                padding: "8px 14px", fontSize: 13, cursor: "pointer",
                background: e.id === call.assigned_to_id ? "#ede9fe" : "",
                color: e.id === call.assigned_to_id ? "#7c3aed" : "#111827",
                fontWeight: e.id === call.assigned_to_id ? 600 : 400,
              }}
              onMouseEnter={ev => { if (e.id !== call.assigned_to_id) ev.currentTarget.style.background = "#f5f3ff"; }}
              onMouseLeave={ev => { if (e.id !== call.assigned_to_id) ev.currentTarget.style.background = ""; }}
            >
              {e.id === call.assigned_to_id ? "✓ " : ""}{e.name}
              {e.role === "manager" && <span style={{ marginLeft: 6, fontSize: 10, color: "#9ca3af" }}>manager</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskStatusPicker({ call, onUpdated }) {
  const [saving, setSaving] = useState(null);

  const pick = async (status) => {
    if (status === call.task_status) return;
    setSaving(status);
    try {
      const updated = await api.updateTaskStatus(call.id, status);
      onUpdated(updated);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
        Task Status
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {TASK_STATUSES.map(s => {
          const ts = TASK_STATUS_STYLE[s];
          const active = (call.task_status || "To Do") === s;
          return (
            <button
              key={s}
              onClick={() => pick(s)}
              disabled={!!saving}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                border: active ? `2px solid ${ts.dot}` : "2px solid #e5e7eb",
                background: active ? ts.background : "#fff",
                color: active ? ts.color : "#9ca3af",
                display: "inline-flex", alignItems: "center", gap: 6,
                transition: "all .12s",
                opacity: saving && saving !== s ? 0.5 : 1,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? ts.dot : "#d1d5db", display: "inline-block" }} />
              {saving === s ? "Saving…" : s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ManagerOverview({ stats, calls, employees }) {
  // Compute assignee breakdown from loaded calls
  const byPerson = {};
  calls.forEach(c => {
    const name = c.assigned_to_name || "Unassigned";
    const id = c.assigned_to_id || "__none__";
    if (!byPerson[id]) byPerson[id] = { name, total: 0, todo: 0, inProgress: 0, complete: 0 };
    byPerson[id].total++;
    const ts = c.task_status || "To Do";
    if (ts === "To Do") byPerson[id].todo++;
    else if (ts === "In Progress") byPerson[id].inProgress++;
    else if (ts === "Complete") byPerson[id].complete++;
  });
  const sorted = Object.values(byPerson).sort((a, b) => b.total - a.total);

  return (
    <div style={{ padding: "28px 32px", height: "100%", overflowY: "auto", boxSizing: "border-box" }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Manager Overview</div>
      <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>Select a call on the left to view details</div>

      {/* Today summary */}
      {stats && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Today</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
            {[
              { label: "Total Calls", value: stats.today_total, color: "#7c3aed" },
              { label: "🚗 Auto", value: stats.today_auto, color: "#1e40af" },
              { label: "🏠 Retail", value: stats.today_retail, color: "#9d174d" },
              { label: "✨ New", value: stats.today_new, color: "#166534" },
              { label: "Existing", value: stats.today_existing, color: "#374151" },
            ].map(s => (
              <div key={s.label} style={{
                background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10,
                padding: "14px 18px", minWidth: 90, flex: "1 1 80px",
              }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value ?? 0}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Assignment breakdown */}
      {sorted.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
            Assignment Breakdown — current view
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#faf5ff", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Person</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#374151" }}>Total</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#9ca3af" }}>⬜ To Do</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#92400e" }}>🔄 In Progress</th>
                  <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, color: "#166534" }}>✅ Complete</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => (
                  <tr key={row.name} style={{ borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", background: row.name === "Unassigned" ? "#fffbeb" : "" }}>
                    <td style={{ padding: "9px 14px", color: row.name === "Unassigned" ? "#92400e" : "#111827", fontWeight: row.name === "Unassigned" ? 400 : 500 }}>
                      {row.name === "Unassigned" ? "⚠ Unassigned" : `👤 ${row.name}`}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: "#7c3aed" }}>{row.total}</td>
                    <td style={{ padding: "9px 10px", textAlign: "center", color: "#9ca3af" }}>{row.todo || "—"}</td>
                    <td style={{ padding: "9px 10px", textAlign: "center", color: "#92400e" }}>{row.inProgress || "—"}</td>
                    <td style={{ padding: "9px 10px", textAlign: "center", color: "#166534" }}>{row.complete || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CallDetail({ call, employees, onAssigned, onStatusUpdated }) {
  if (!call) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 32 }}>📞</div>
      <div>Select a call to view details</div>
    </div>
  );

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {call.customer_type
              ? <Badge type="type" value={call.customer_type} />
              : <span style={{ background: "#f3f4f6", color: "#9ca3af", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Type unknown</span>
            }
            {call.customer_status
              ? <Badge type="status" value={call.customer_status} />
              : <span style={{ background: "#f3f4f6", color: "#9ca3af", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>Status unknown</span>
            }
            {!call.ai_processed && (
              <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                ⏳ Awaiting AI
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {fmt(call.received_at)}
            {call.email_subject && <span> · {call.email_subject}</span>}
          </div>
        </div>
        <AssignPicker call={call} employees={employees} onAssigned={onAssigned} />
      </div>

      {/* Assignment banner */}
      {call.assigned_to_name && (
        <div style={{
          background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 8,
          padding: "8px 14px", fontSize: 13, color: "#5b21b6", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>👤</span>
          <span>Assigned to <strong>{call.assigned_to_name}</strong></span>
        </div>
      )}

      {/* Task status */}
      <div style={{ marginBottom: 20 }}>
        <TaskStatusPicker call={call} onUpdated={onStatusUpdated} />
      </div>

      {/* Phone */}
      {call.customer_phone && (
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Phone</label>
          <a href={`tel:${call.customer_phone}`} style={{ fontSize: 18, color: "#111827", fontWeight: 600, textDecoration: "none" }}>
            📞 {call.customer_phone}
          </a>
        </div>
      )}

      {/* Summary */}
      {call.summary ? (
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Call Summary</label>
          <div style={{
            background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
            padding: "14px 16px", fontSize: 14, lineHeight: 1.75, color: "#111827",
            whiteSpace: "pre-wrap",
          }}>
            {call.summary}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Call Summary</label>
          <div style={{
            background: "#fffbeb", border: "1px dashed #fcd34d", borderRadius: 8,
            padding: "14px 16px", fontSize: 13, color: "#92400e",
          }}>
            {call.ai_processed
              ? "No summary was extracted from this call."
              : "Add GEMINI_API_KEY to .env and restart backend to enable AI summaries."
            }
          </div>
        </div>
      )}

      {/* Raw email */}
      {call.raw_body && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#9ca3af", userSelect: "none" }}>
            View raw email
          </summary>
          <div style={{
            marginTop: 8, background: "#f9fafb", border: "1px solid #e5e7eb",
            borderRadius: 6, padding: "10px 12px", fontSize: 11, color: "#6b7280",
            maxHeight: 320, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5,
          }}>
            {call.raw_body}
          </div>
        </details>
      )}
    </div>
  );
}

const lbl = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280",
  textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8,
};

const DAYS_OPTIONS = [
  { label: "Today", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
];

const MIN_SIDEBAR = 260;
const MAX_SIDEBAR = 600;

export default function DashboardPage() {
  const user = JSON.parse(localStorage.getItem("zyra_user") || "{}");
  const isManager = user.role === "manager" || user.role === "admin";

  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // View toggle: employees default to "My Calls", managers/admins default to "All Calls"
  const [viewMode, setViewMode] = useState(isManager ? "all" : "mine");

  // Resizable sidebar
  const [sidebarW, setSidebarW] = useState(320);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onDragStart = (e) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = sidebarW;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      setSidebarW(Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, startW.current + delta)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { days };
      if (typeFilter) params.customer_type = typeFilter;
      if (statusFilter) params.customer_status = statusFilter;
      const [data, statsData] = await Promise.all([
        api.listCalls(params),
        api.getStats(),
      ]);
      setCalls(data);
      setStats(statsData);
      if (selectedCall) {
        const updated = data.find(c => c.id === selectedCall.id);
        if (updated) setSelectedCall(updated);
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, days, refreshKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.listEmployees().then(setEmployees).catch(() => {});
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const t = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const handleAssigned = (updatedCall) => {
    setCalls(prev => prev.map(c => c.id === updatedCall.id ? updatedCall : c));
    setSelectedCall(updatedCall);
  };

  const handleStatusUpdated = (updatedCall) => {
    setCalls(prev => prev.map(c => c.id === updatedCall.id ? updatedCall : c));
    setSelectedCall(updatedCall);
  };

  // Filter calls client-side
  const visibleCalls = calls
    .filter(c => showCompleted || (c.task_status || "To Do") !== "Complete")
    .filter(c => viewMode === "mine" && user.id ? c.assigned_to_id === user.id : true);

  const filterBtn = (active, label, onClick) => (
    <button
      onClick={onClick}
      style={{
        padding: "4px 11px", borderRadius: 14, border: "1px solid",
        fontSize: 11, cursor: "pointer", fontWeight: 500,
        background: active ? "#7c3aed" : "transparent",
        color: active ? "#fff" : "#6b7280",
        borderColor: active ? "#7c3aed" : "#d1d5db",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  const viewToggleBtn = (mode, label) => (
    <button
      onClick={() => setViewMode(mode)}
      style={{
        flex: 1, padding: "5px 0", fontSize: 12, cursor: "pointer",
        fontWeight: viewMode === mode ? 700 : 400,
        background: viewMode === mode ? "#7c3aed" : "transparent",
        color: viewMode === mode ? "#fff" : "#7c3aed",
        border: "1px solid #7c3aed",
        borderRadius: mode === "mine" ? "6px 0 0 6px" : "0 6px 6px 0",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: call list */}
      <div style={{
        width: sidebarW, display: "flex", flexDirection: "column",
        flexShrink: 0, background: "#fff",
      }}>
        {stats && (
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #f3f4f6", background: "#faf5ff" }}>
            <div style={{ fontSize: 10, color: "#7c3aed", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>
              Today's Calls
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <StatCard label="Total" value={stats.today_total} color="#7c3aed" />
              <StatCard label="🚗 Auto" value={stats.today_auto} color="#1e40af" />
              <StatCard label="🏠 Retail" value={stats.today_retail} color="#9d174d" />
            </div>
          </div>
        )}

        {/* View toggle */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ display: "flex" }}>
            {viewToggleBtn("mine", "My Calls")}
            {viewToggleBtn("all", "All Calls")}
          </div>
        </div>

        <div style={{ padding: "8px 12px", borderBottom: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#6b7280", minWidth: 38 }}>Type:</span>
            {filterBtn(!typeFilter, "All", () => setTypeFilter(""))}
            {filterBtn(typeFilter === "Auto", "🚗 Auto", () => setTypeFilter("Auto"))}
            {filterBtn(typeFilter === "Retail", "🏠 Retail", () => setTypeFilter("Retail"))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#6b7280", minWidth: 38 }}>Status:</span>
            {filterBtn(!statusFilter, "All", () => setStatusFilter(""))}
            {filterBtn(statusFilter === "New", "✨ New", () => setStatusFilter("New"))}
            {filterBtn(statusFilter === "Existing", "Existing", () => setStatusFilter("Existing"))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#6b7280", minWidth: 38 }}>Range:</span>
            {DAYS_OPTIONS.map(o => filterBtn(days === o.value, o.label, () => setDays(o.value)))}
            <button
              onClick={() => setShowCompleted(v => !v)}
              style={{
                marginLeft: "auto", borderRadius: 6, padding: "2px 9px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                border: showCompleted ? "1px solid #22c55e" : "1px solid #d1d5db",
                background: showCompleted ? "#dcfce7" : "none",
                color: showCompleted ? "#166534" : "#6b7280",
              }}
              title="Toggle completed calls"
            >
              {showCompleted ? "✅ Hide done" : "✅ Show done"}
            </button>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "2px 7px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}
              title="Refresh"
            >⟳</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading && <p style={{ padding: 16, color: "#9ca3af", fontSize: 13 }}>Loading…</p>}
          {!loading && visibleCalls.length === 0 && (
            <p style={{ padding: 24, color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
              {viewMode === "mine"
                ? "No calls assigned to you"
                : "No calls found"}
            </p>
          )}
          {visibleCalls.map(c => (
            <CallRow key={c.id} call={c} selected={c.id === selectedCall?.id} onClick={() => setSelectedCall(c)} />
          ))}
        </div>
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{
          width: 5, cursor: "col-resize", flexShrink: 0,
          background: "transparent", borderRight: "1px solid #e5e7eb",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#ede9fe"}
        onMouseLeave={e => { if (!dragging.current) e.currentTarget.style.background = "transparent"; }}
      />

      {/* Right: call detail or manager overview */}
      <div style={{ flex: 1, overflow: "hidden", background: "#fff" }}>
        {!selectedCall && isManager && viewMode === "all"
          ? <ManagerOverview stats={stats} calls={calls} employees={employees} />
          : <CallDetail call={selectedCall} employees={employees} onAssigned={handleAssigned} onStatusUpdated={handleStatusUpdated} />
        }
      </div>
    </div>
  );
}
