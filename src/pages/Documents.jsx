import { Download, FileText, ExternalLink } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
export default function Documents(){
  const docs=[["TASK-01","AD TECH Task Document","Frontend Development Task","PDF"],["RESOURCE","AD TECH Internship Documents","Official resource folder","Drive"]];
  return <>
    <PageHeader eyebrow="Resources" title="Documents" description="Task PDFs and internship resources mapped to your work."/>
    <div className="doc-list">{docs.map(d=><Card key={d[0]}><div className="doc-row"><div className="doc-icon"><FileText/></div><div className="doc-copy"><span>{d[0]}</span><h3>{d[1]}</h3><p>{d[2]}</p></div><div className="doc-actions"><button className="btn btn-secondary"><ExternalLink size={15}/> View</button><button className="icon-btn"><Download size={17}/></button></div></div></Card>)}</div>
  </>;
}