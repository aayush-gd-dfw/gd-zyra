import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(username, password);
      localStorage.setItem("zyra_token", data.access_token);
      localStorage.setItem("zyra_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: "40px 36px", width: 360,
        boxShadow: "0 8px 32px rgba(0,0,0,.18)",
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>🎙️ Zyra Dashboard</h1>
        <p style={{ color: "#6b7280", marginBottom: 28, fontSize: 13 }}>Glass Doctor DFW — AI Call Log</p>
        <form onSubmit={submit}>
          <label style={lbl}>Username</label>
          <input style={inp} value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. aayush" autoFocus />
          <label style={lbl}>Password</label>
          <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          {error && <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button style={btn} type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
        </form>
        <p style={{ marginTop: 20, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
          Default password: <strong>password123</strong>
        </p>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 };
const inp = { width: "100%", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, marginBottom: 16, outline: "none" };
const btn = { width: "100%", padding: "10px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 15, cursor: "pointer", marginTop: 4 };
