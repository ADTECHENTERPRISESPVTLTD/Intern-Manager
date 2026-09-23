import { CalendarDays, Mail, ShieldCheck, UserRound } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import { intern } from "../constants/app";
export default function Profile(){
  return <>
    <PageHeader eyebrow="Account" title="Profile" description="Your internship identity and assigned role information."/>
    <div className="profile-grid"><Card className="profile-card"><div className="profile-avatar">{intern.initials}</div><h2>{intern.name}</h2><p>{intern.designation}</p><span className="badge badge-success"><ShieldCheck size={13}/> Active intern</span></Card><Card><div className="detail-list"><div><UserRound/><span>Name<strong>{intern.name}</strong></span></div><div><Mail/><span>Designation<strong>{intern.designation}</strong></span></div><div><CalendarDays/><span>Joining date<strong>{intern.joiningDate}</strong></span></div><div><ShieldCheck/><span>Team<strong>{intern.team}</strong></span></div></div></Card></div>
    <Card><div className="card-title">Skills</div><div className="chips">{intern.skills.map(s=><span key={s}>{s}</span>)}</div></Card>
  </>;
}