import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, ChevronRight, CircleHelp, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { navItems, adminNavItems } from "../constants/app";
import { PresenceVerification } from "../presence-verification";
import { useVerificationStatus } from "../verificationContext";
import { useAuth } from "../authContext";

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, logout } = useAuth();
  const { service, setStatus, ready } = useVerificationStatus();

  // Driven by the real route (not a separate click-toggle), so it stays correct on
  // back/forward navigation or a direct URL, and never shows admin nav to a non-admin.
  const onAdminRoute = location.pathname.startsWith("/admin");
  const items = onAdminRoute ? adminNavItems : navItems;
  const initials = user?.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  function doLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">AD</div>
          {!collapsed && <div><strong>AD TECH</strong><span>Intern Manager</span></div>}
          <button className="icon-btn mobile-close" onClick={() => setMobile(false)}><X size={19}/></button>
        </div>
        {/* Only an admin ever sees this switch; an intern has no admin routes to switch to. */}
        {isAdmin && (
          <div className="portal-switch">
            <button className={!onAdminRoute ? "active" : ""} onClick={() => navigate("/")}>Intern Portal</button>
            <button className={onAdminRoute ? "active" : ""} onClick={() => navigate("/admin")}><ShieldCheck size={15}/> Admin</button>
          </div>
        )}
        <nav>
          {items.map(([label, path]) => (
            <NavLink key={path} to={path} onClick={() => setMobile(false)} className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              <span className="nav-dot"></span>{!collapsed && label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!collapsed && (
            <div className="mini-profile">
              <div className="avatar">{initials}</div>
              <div><strong>{user?.name ?? "…"}</strong><span>{onAdminRoute ? "Administrator view" : (user?.designation ?? "")}</span></div>
            </div>
          )}
          <button className="nav-link" onClick={doLogout}><LogOut size={17}/>{!collapsed && "Logout"}</button>
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight/> : <ChevronLeft/>}</button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobile(true)}><Menu size={21}/></button>
          <div className="topbar-title">{onAdminRoute ? "Administration" : "Intern workspace"}</div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => navigate("/notifications")}><Bell size={19}/><span className="notification-dot"/></button>
            <button className="help-btn"><CircleHelp size={17}/> Help</button>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>

      {/* Mounted once here (not per-page). Appears on its own when the backend says a check
          is due; the intern never has to hunt for it on a specific page.
          `ready` is false for admins (see verificationContext) and while login is still resolving. */}
      {ready && (
        <PresenceVerification
          service={service}
          pollIntervalMs={3000}
          onStatusChange={setStatus}
          onSessionExpired={doLogout}
          onRegistrationRequired={() => navigate("/dev-register-face")}
        />
      )}
    </div>
  );
}
