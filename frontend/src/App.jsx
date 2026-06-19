import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TeamsConfigPage from "./pages/TeamsConfigPage";
import Navbar from "./components/Navbar";

function RequireAuth({ children }) {
  const token = localStorage.getItem("zyra_token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/teams-config" element={<TeamsConfigPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
                <Navbar />
                <div style={{ flex: 1, overflow: "auto", background: "#f9fafb" }}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                  </Routes>
                </div>
              </div>
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
