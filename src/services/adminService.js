import { apiRequest } from "./apiClient";

export const adminService = {
  dashboard: () => apiRequest("/api/admin/dashboard"),
  interns: () => apiRequest("/api/admin/interns"),
  intern: (id) => apiRequest(`/api/admin/interns/${id}`)
};