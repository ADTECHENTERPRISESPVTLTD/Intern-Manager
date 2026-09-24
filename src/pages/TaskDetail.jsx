import { ArrowLeft, CalendarDays, FileText, Link as LinkIcon, Send, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import Card from "../components/Card";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";

export default function TaskDetail(){
  const {id} = useParams();
  return <>
    <Link to="/tasks" className="back-link"><ArrowLeft size={16}/> Back to tasks</Link>
    <PageHeader eyebrow={id} title="DevOps, Deployment & Release Management" description="Complete task information, requirements, resources, submission and feedback." action={<StatusBadge tone="warning">In Progress</StatusBadge>}/>
    <div className="detail-grid">
      <div className="stack">
        <Card><div className="card-title"><FileText size={18}/> Description</div><p>Complete the frontend interface for the AD TECH Intern Management & Work Platform with clean integration points for the backend and face-verification modules.</p></Card>
        <Card><div className="card-title"><FileText size={18}/> Requirements</div><ul className="check-list"><li>Responsive intern and admin experiences</li><li>Work session and 30-second session display</li><li>Task management and daily reports</li><li>Attendance and presence verification UI</li><li>API service architecture</li></ul></Card>
        <Card><div className="card-title"><Send size={18}/> Submit work</div><textarea className="textarea" placeholder="Describe your submission..."/><input className="input" placeholder="Proof-of-work URL"/><button className="btn btn-primary"><Send size={16}/> Submit Work</button></Card>
      </div>
      <div className="stack">
        <Card><div className="meta-list"><div><CalendarDays/><span>Deadline<strong>24 Sep 2026, 7:00 PM</strong></span></div><div><UserRound/><span>Assigned intern<strong>Akanksha Hajare</strong></span></div><div><LinkIcon/><span>Resource<strong>AD TECH Internship Documents</strong></span></div></div></Card>
        <Card><div className="card-title">Reviewer feedback</div><div className="empty-inline">No reviewer feedback yet.</div></Card>
      </div>
    </div>
  </>;
}