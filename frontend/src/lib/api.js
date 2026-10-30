import axios from "axios";

export const api = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api` });

export const tokens = {
  set: (a, r) => { localStorage.setItem("fr_at", a); if (r) localStorage.setItem("fr_rt", r); },
  clear: () => { localStorage.removeItem("fr_at"); localStorage.removeItem("fr_rt"); },
  has: () => !!localStorage.getItem("fr_at"),
};

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("fr_at");
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

let refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config;
    const rt = localStorage.getItem("fr_rt");
    if (err.response?.status === 401 && rt && !cfg._retry && !cfg.url.includes("/auth/")) {
      cfg._retry = true;
      try {
        refreshing = refreshing || axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/auth/refresh`, { refresh_token: rt });
        const { data } = await refreshing;
        tokens.set(data.access_token, data.refresh_token);
        return api(cfg);
      } catch {
        tokens.clear();
        window.location.href = "/";
      } finally {
        refreshing = null;
      }
    }
    return Promise.reject(err);
  }
);

export function errMsg(e) {
  const detail = e?.response?.data?.detail;
  if (detail == null) return e?.message || "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  return detail.msg || String(detail);
}

export const fmt = (n) => {
  if (n == null) return "0";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return Math.floor(n).toLocaleString();
};
