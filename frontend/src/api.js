const BASE = import.meta.env.VITE_API_URL || "";

function getToken() {
  return localStorage.getItem("zyra_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("zyra_token");
    localStorage.removeItem("zyra_user");
    window.location.href = "/login";
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  login: (username, password) => {
    const body = new URLSearchParams({ username, password });
    return fetch(`${BASE}/api/auth/login`, { method: "POST", body }).then(async (r) => {
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || "Login failed");
      }
      return r.json();
    });
  },

  me: () => request("/api/auth/me"),

  listCalls: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
    ).toString();
    return request(`/api/calls${qs ? `?${qs}` : ""}`);
  },

  getCall: (id) => request(`/api/calls/${id}`),
  getStats: () => request("/api/calls/stats"),
  listEmployees: () => request("/api/calls/employees"),

  assignCall: (callId, employeeId) =>
    request(`/api/calls/${callId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ employee_id: employeeId || null }),
    }),

  updateTaskStatus: (callId, taskStatus) =>
    request(`/api/calls/${callId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ task_status: taskStatus }),
    }),

  // Assignment rules
  listRules: () => request("/api/rules"),

  upsertRule: (customer_type, customer_status, employee_id) =>
    request("/api/rules", {
      method: "PUT",
      body: JSON.stringify({
        customer_type: customer_type || null,
        customer_status: customer_status || null,
        employee_id: employee_id || null,
      }),
    }),

  listRuleEmployees: () => request("/api/rules/employees"),

  // Employee management (manager/admin only)
  listAllEmployees: () => request("/api/employees"),
  createEmployee: (body) => request("/api/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id, body) => request(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};
