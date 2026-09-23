import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, ChevronRight, CircleHelp, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { navItems, adminNavItems, intern } from "../constants/app";

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [admin, setAdmin] = useState(false);
  const navigate = useNavigate();
  const items = admin ? adminNavItems : navItems;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobile ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">AD</div>
          {!collapsed && <div><strong>AD TECH</strong><span>Intern Manager</span></div>}
          <button className="icon-btn mobile-close" onClick={() => setMobile(false)}><X size={19}/></button>
        </div>
        <div className="portal-switch">
          <button className={!admin ? "active" : ""} onClick={() => {setAdmin(false); navigate("/")}}>Intern Portal</button>
          <button className={admin ? "active" : ""} onClick={() => {setAdmin(true); navigate("/admin")}}><ShieldCheck size={15}/> Admin</button>
        </div>
        <nav>
          {items.map(([label, path]) => (
            <NavLink key={path} to={path} onClick={() => setMobile(false)} className={({isActive}) => isActive ? "nav-link active" : "nav-link"}>
              <span className="nav-dot"></span>{!collapsed && label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!collapsed && <div className="mini-profile"><div className="avatar">{intern.initials}</div><div><strong>{intern.name}</strong><span>{admin ? "Administrator view" : intern.designation}</span></div></div>}
          <button className="nav-link" onClick={() => navigate("/login")}><LogOut size={17}/>{!collapsed && "Logout"}</button>
        </div>
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight/> : <ChevronLeft/>}</button>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobile(true)}><Menu size={21}/></button>
          <div className="topbar-title">{admin ? "Administration" : "Intern workspace"}</div>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={() => navigate("/notifications")}><Bell size={19}/><span className="notification-dot"/></button>
            <button className="help-btn"><CircleHelp size={17}/> Help</button>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}