import { Link } from "react-router-dom";
import { ExternalLink, Search, SlidersHorizontal } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";

const tasks = [
  {id:"TASK-01", title:"DevOps, Deployment & Release Management", project:"Intern Manager", priority:"High", date:"21 Sep 2026", deadline:"24 Sep 2026", status:"In Progress", progress:72, submission:"Not Submitted", feedback:"—"},
  {id:"TASK-02", title:"Vercel & Render Setup", project:"Deployment", priority:"Medium", date:"21 Sep 2026", deadline:"24 Sep 2026", status:"Submitted", progress:100, submission:"Submitted", feedback:"Awaiting review"},
  {id:"TASK-03", title:"Frontend API Service Architecture", project:"Intern Manager", priority:"High", date:"22 Sep 2026", deadline:"24 Sep 2026", status:"In Progress", progress:40, submission:"Not Submitted", feedback:"—"}
];

export default function Tasks(){
  return <>
    <PageHeader eyebrow="Intern workspace" title="My Tasks" description="Track assigned work, progress, submissions and reviewer feedback." action={<button className="btn btn-secondary"><SlidersHorizontal size={16}/> Filters</button>}/>
    <Card>
      <div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Search tasks..."/></div><select><option>All statuses</option><option>In Progress</option><option>Submitted</option><option>Completed</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>Task</th><th>Project</th><th>Priority</th><th>Deadline</th><th>Status</th><th>Progress</th><th>Submission</th><th/></tr></thead><tbody>
      {tasks.map(t=><tr key={t.id}><td><div className="table-task"><span>{t.id}</span><strong>{t.title}</strong></div></td><td>{t.project}</td><td><StatusBadge tone={t.priority==="High"?"danger":"warning"}>{t.priority}</StatusBadge></td><td>{t.deadline}</td><td><StatusBadge tone={t.status==="Submitted"?"success":"warning"}>{t.status}</StatusBadge></td><td><div className="table-progress"><div className="progress small"><span style={{width:`${t.progress}%`}}/></div>{t.progress}%</div></td><td>{t.submission}</td><td><Link className="icon-link" to={`/tasks/${t.id}`}><ExternalLink size={17}/></Link></td></tr>)}
      </tbody></table></div>
    </Card>
  </>;
}