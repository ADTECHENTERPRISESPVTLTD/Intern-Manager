import { Activity, Clock3, ListTodo, ShieldAlert, Users, Coffee } from "lucide-react";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";

const interns=[["Akanksha Hajare","DevOps & Deployment Engineer","Active","04:32:30","3","—"],["Adarsh Gangshettiwar","Backend Developer","Active","05:12:10","4","—"],["Aadya Dixit","Frontend Developer","Break","03:41:20","2","—"],["Prajakta Dixit","Lead Frontend Developer","Offline","00:00:00","5","—"],["Soham Amne","AI Lead","Unverified","04:01:55","3","—"]];

export default function AdminDashboard(){
 return <>
  <PageHeader eyebrow="Administration" title="Admin Dashboard" description="Team-wide overview of internship work sessions, tasks and presence."/>
  <div className="stats-grid"><StatCard icon={Users} label="Total interns" value="5" detail="Current internship team"/><StatCard icon={Activity} label="Active now" value="2" detail="Official work sessions"/><StatCard icon={Coffee} label="On break" value="1" detail="Current status"/><StatCard icon={ShieldAlert} label="Unverified" value="1" detail="Action may be required"/><StatCard icon={Clock3} label="Completed today" value="2" detail="Sessions"/><StatCard icon={ListTodo} label="Pending tasks" value="9" detail="Across team"/></div>
  <Card><div className="card-header"><div><div className="eyebrow">Team</div><h2>Intern status</h2></div></div><div className="table-wrap"><table><thead><tr><th>Intern</th><th>Designation</th><th>Status</th><th>Work Time</th><th>Tasks</th><th>Performance</th></tr></thead><tbody>{interns.map(x=><tr key={x[0]}><td><strong>{x[0]}</strong></td><td>{x[1]}</td><td><StatusBadge tone={x[2]==="Active"?"success":x[2]==="Unverified"?"danger":x[2]==="Break"?"warning":"default"}>{x[2]}</StatusBadge></td><td>{x[3]}</td><td>{x[4]}</td><td>Backend data</td></tr>)}</tbody></table></div></Card>
 </>;
}