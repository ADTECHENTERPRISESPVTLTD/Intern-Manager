import { Bell, ShieldCheck } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
export default function Notifications(){
  return <>
    <PageHeader eyebrow="Updates" title="Notifications" description="System and work-related notifications."/>
    <div className="notification-list"><Card><div className="notification"><div className="notify-icon"><ShieldCheck/></div><div><strong>Presence verification may be required</strong><p>The backend can request a verification check during an active official work session.</p><small>Today · System</small></div></div></Card><Card><div className="notification"><div className="notify-icon"><Bell/></div><div><strong>TASK-01 deadline reminder</strong><p>Your DevOps, Deployment & Release Management task is due on 24 Sep 2026.</p><small>Today · Task Manager</small></div></div></Card></div>
  </>;
}