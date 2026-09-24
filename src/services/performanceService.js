import { apiRequest } from "./apiClient";

export const performanceService = {
  mine: () => apiRequest("/api/performance"),
  admin: () => apiRequest("/api/admin/performance")
};