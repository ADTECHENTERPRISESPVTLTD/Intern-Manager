import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { RequireAuth, RequireAdmin } from "./routeGuards";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import WorkSession from "./pages/WorkSession";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import Projects from "./pages/Projects";
import Performance from "./pages/Performance";
import Profile from "./pages/Profile";
import Documents from "./pages/Documents";
import Notifications from "./pages/Notifications";
import AdminDashboard from "./pages/AdminDashboard";
import AdminInterns from "./pages/AdminInterns";
import AdminTasks from "./pages/AdminTasks";
import AdminPerformance from "./pages/AdminPerformance";
import RegisterFace from "./pages/RegisterFace";

function Shell({children}) { return <RequireAuth><AppLayout>{children}</AppLayout></RequireAuth>; }
function AdminShell({children}) { return <RequireAuth><RequireAdmin><AppLayout>{children}</AppLayout></RequireAdmin></RequireAuth>; }

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login/>}/>
    {/* TEMPORARY: lets an intern register their own face for testing until a real onboarding flow exists */}
    <Route path="/dev-register-face" element={<RequireAuth><RegisterFace/></RequireAuth>}/>
    <Route path="/" element={<Shell><Dashboard/></Shell>}/>
    <Route path="/tasks" element={<Shell><Tasks/></Shell>}/>
    <Route path="/tasks/:id" element={<Shell><TaskDetail/></Shell>}/>
    <Route path="/work-session" element={<Shell><WorkSession/></Shell>}/>
    <Route path="/attendance" element={<Shell><Attendance/></Shell>}/>
    <Route path="/reports" element={<Shell><Reports/></Shell>}/>
    <Route path="/projects" element={<Shell><Projects/></Shell>}/>
    <Route path="/performance" element={<Shell><Performance/></Shell>}/>
    <Route path="/profile" element={<Shell><Profile/></Shell>}/>
    <Route path="/documents" element={<Shell><Documents/></Shell>}/>
    <Route path="/notifications" element={<Shell><Notifications/></Shell>}/>
    <Route path="/admin" element={<AdminShell><AdminDashboard/></AdminShell>}/>
    <Route path="/admin/interns" element={<AdminShell><AdminInterns/></AdminShell>}/>
    <Route path="/admin/tasks" element={<AdminShell><AdminTasks/></AdminShell>}/>
    <Route path="/admin/performance" element={<AdminShell><AdminPerformance/></AdminShell>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>;
}
