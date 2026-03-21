import { mockApi } from "./mock.js";

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  CONFIG
// ║  USE_MOCK = true  → npm run dev  → dùng mockApi, không cần backend
// ║  USE_MOCK = false → npm run build → gọi FastAPI thật qua API_BASE
// ╚══════════════════════════════════════════════════════════════════════════════
export const USE_MOCK = import.meta.env.DEV;
export const API_BASE = import.meta.env.DEV ? "http://localhost:8000" : "";

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  REAL API
// ╚══════════════════════════════════════════════════════════════════════════════
const realApi = {
  machines: () =>
    fetch(`${API_BASE}/machines`).then(r => {
      if (!r.ok) throw new Error(`GET /machines failed: ${r.status}`);
      return r.json();
    }),

  recommend: (machineIds, file, useDb) => {
    const fd = new FormData();
    // Append từng id riêng — FastAPI nhận List[str]
    machineIds.forEach(id => fd.append("machine_ids", id));
    if (file) fd.append("file",   file);
    else      fd.append("use_db", "true");
    // KHÔNG set Content-Type — browser tự tính multipart boundary
    return fetch(`${API_BASE}/recommend`, { method: "POST", body: fd })
      .then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.detail || `${r.status}`); });
        return r.json();
      });
  },
};

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  EXPORT — component chỉ cần import { api } từ đây, không biết gì thêm
// ╚══════════════════════════════════════════════════════════════════════════════
export const api = USE_MOCK ? mockApi : realApi;