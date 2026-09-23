import { ExternalLink, GitBranch } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
export default function Projects(){
  return <>
    <PageHeader eyebrow="My workspace" title="My Projects" description="Projects assigned to you and their current delivery context."/>
    <div className="project-grid">
      <Card><div className="project-head"><div className="project-logo">IM</div><div><h2>Intern Manager</h2><span>Active</span></div></div><p>AD TECH internal internship management and work platform.</p><div className="chips"><span>React</span><span>Node.js</span><span>MongoDB</span><span>AWS</span></div><div className="project-meta"><span>Role<strong>Frontend / DevOps</strong></span><span>Tasks<strong>3 assigned</strong></span></div><div className="button-row"><button className="btn btn-secondary"><GitBranch size={16}/> Repository</button><button className="btn btn-ghost"><ExternalLink size={16}/> Deployment</button></div></Card>
    </div>
  </>;
}