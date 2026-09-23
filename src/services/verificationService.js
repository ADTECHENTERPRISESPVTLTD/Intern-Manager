import { apiRequest } from "./apiClient";

export const verificationService = {
  status: () => apiRequest("/api/verification/status"),
  verify: (payload) => apiRequest("/api/verification/verify", { method: "POST", body: JSON.stringify(payload) })
};