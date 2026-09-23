import { apiRequest } from "./apiClient";

export const documentService = {
  list: () => apiRequest("/api/documents")
};