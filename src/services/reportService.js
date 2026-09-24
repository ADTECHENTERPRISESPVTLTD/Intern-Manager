import { apiRequest } from "./apiClient";

export const reportService = {
  list: () => apiRequest("/api/reports"),
  create: (payload) => apiRequest("/api/reports", { method: "POST", body: JSON.stringify(payload) })
};