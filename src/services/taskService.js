import { apiRequest } from "./apiClient";

export const taskService = {
  list: () => apiRequest("/api/tasks"),
  get: (id) => apiRequest(`/api/tasks/${id}`),
  create: (payload) => apiRequest("/api/tasks", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  archive: (id) => apiRequest(`/api/tasks/${id}`, { method: "DELETE" })
};