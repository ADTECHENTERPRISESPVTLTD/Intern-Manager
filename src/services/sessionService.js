import { apiRequest } from "./apiClient";

export const sessionService = {
  current: () => apiRequest("/api/session/current"),
  start: () => apiRequest("/api/session/start", { method: "POST" }),
  breakStart: () => apiRequest("/api/session/break/start", { method: "POST" }),
  resume: () => apiRequest("/api/session/resume", { method: "POST" }),
  complete: () => apiRequest("/api/session/complete", { method: "POST" })
};