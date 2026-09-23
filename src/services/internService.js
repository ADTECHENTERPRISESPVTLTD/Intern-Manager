import { apiRequest } from "./apiClient";

export const internService = {
  profile: () => apiRequest("/api/intern/me"),
  projects: () => apiRequest("/api/projects")
};