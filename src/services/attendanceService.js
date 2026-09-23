import { apiRequest } from "./apiClient";

export const attendanceService = {
  currentMonth: () => apiRequest("/api/attendance"),
  breaks: () => apiRequest("/api/attendance/breaks")
};