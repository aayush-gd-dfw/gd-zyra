import { useNavigate, Link, useLocation } from "react-router-dom";

const PURPLE = "#7c3aed";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const userRaw = localStorage.getItem("zyra_user");
  const user = userRaw ? JSON.parse(userRaw) : {};
  const canSeeRules = user.role === "manager" || user.role === "admin";

  const logout = () => {
    localStorage.removeItem("zyra_token");
    localStorage.removeItem("zyra_user");
    navigate("/login");
  };

  const linkStyle = (path) => ({
    color: location.pathname.startsWith(path) ? "#fff" : "rgba(255,255,255,.75)",
    textDecoration: "none",
    fontWeight: location.pathname.startsWith(path) ? 700 : 400,
    fontSize: 14,
    padding: "4px 0",
    borderBottom: location.pathname.startsWith(path) ? "2px solid #fff" : "2px solid transparent",
  });

  return (
    <nav style={{
      background: PURPLE,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      height: 52,
      gap: 24,
      flexShrink: 0,
      boxShadow: "0 1px 4px rgba(0,0,0,.18)",
    }}>
      <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-.01em" }}>
        🎙 Zyra Call Dashboard
      </span>

      <Link to="/dashboard" style={linkStyle("/dashboard")}>Dashboard</Link>

      {canSeeRules && (
        <Link to="/overview" style={linkStyle("/overview")}>📊 Overview</Link>
      )}

      {canSeeRules && (
        <Link to="/rules" style={linkStyle("/rules")}>⚙ Rules</Link>
      )}

      {canSeeRules && (
        <Link to="/employees" style={linkStyle("/employees")}>👥 Team</Link>
      )}

      <div style={{ flex: 1 }} />

      {user.name && (
        <span style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>
          👤 {user.name}
        </span>
      )}

      <button
        onClick={logout}
        style={{
          background: "rgba(255,255,255,.15)",
          border: "none",
          color: "#fff",
          padding: "5px 12px",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
