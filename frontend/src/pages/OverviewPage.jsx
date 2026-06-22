import { useState, useEffect, useCallback } from "react";
import { api } from "../api";

const DAYS_OPTIONS = [
  { label: "Today", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
];

export default function OverviewPage() {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, statsData] = await Promise.all([
        api.listCalls({ days }),
        api.getStats(),
      ]);
      setCalls(data);
      setStats(statsData);
    } finally {
      setLoading(false);
    }
  }, [days, refreshKey]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => setRefreshKey(k => k + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Compute assignee breakdown
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

  const filterBtn = (active, label, onClick) => (
    <button
      onClick={onClick}
      style={{
        padding: "4px 14px", borderRadius: 14, border: "1px solid",
        fontSize: 12, cursor: "pointer", fontWeight: 500,
        background: active ? "#7c3aed" : "transparent",
        color: active ? "#fff" : "#6b7280",
        borderColor: active ? "#7c3aed" : "#d1d5db",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Manager Overview</div>
          <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>Summary of all calls and team assignment status</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Range:</span>
          {DAYS_OPTIONS.map(o => filterBtn(days === o.value, o.label, () => setDays(o.value)))}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 14, color: "#6b7280" }}
            title="Refresh"
          >â³</button>
        </div>
      </div>

      {loading && <p style={{ color: "#9ca3af", fontSize: 13 }}>Loadingâ¦</p>}

      {stats && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>Today</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
            {[
              { label: "Total Calls", value: stats.today_total, color: "#7c3aed" },
              { label: "ð Auto", value: stats.today_auto, color: "#1e40af" },
              { label: "ð Retail", value: stats.today_retail, color: "#9d174d" },
              { label: "â New", value: stats.today_new, color: "#166534" },
              { label: "Existing", value: stats.today_existing, color: "#374151" },
            ].map(s => (
              <div key={s.label} style={{
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
                padding: "16px 20px", minWidth: 100, flex: "1 1 90px",
                boxShadow: "0 1px 3px rgba(0,0,0,.06)",
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value ?? 0}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
        Assignment Breakdown &mdash; last {days === 1 ? "day" : `${days} days`}
      </div>
      {sorted.length === 0 && !loading ? (
        <div style={{ color: "#9ca3af", fontSize: 13 }}>No calls found for this period.</div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#faf5ff", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Person</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#374151" }}>Total</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#9ca3af" }}>â To Do</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#92400e" }}>ð¤ In Progress</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 600, color: "#166534" }}>â Complete</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr key={row.name} style={{ borderBottom: i < sorted.length - 1 ? "1px solid #f3f4f6" : "none", background: row.name === "Unassigned" ? "#fffbeb" : "" }}>
                  <td style={{ padding: "11px 16px", color: row.name === "Unassigned" ? "#92400e" : "#111827", fontWeight: row.name === "Unassigned" ? 400 : 500 }}>
                    {row.name === "Unassigned" ? "â  Unassigned" : `ð ${row.name}`}
                  </td>
                  <td style={{ padding: "11px 12px", textAlign: "center", fontWeight: 700, color: "#7c3aed" }}>{row.total}</td>
                  <td style={{ padding: "11px 12px", textAlign: "center", color: "#9ca3af" }}>{row.todo || "â"}</td>
                  <td style={{ padding: "11px 12px", textAlign: "center", color: "#92400f" }}>{row.inProgress || "â"}</td>
                  <td style={{ padding: "11px 12px", textAlign: "center", color: "#166534" }}>{row.complete || "â"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
