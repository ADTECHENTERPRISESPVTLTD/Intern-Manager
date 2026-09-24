import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";

export default function Reports(){
  const [sent,setSent]=useState(false);
  return <>
    <PageHeader eyebrow="Daily work" title="Daily Reports" description="Submit a concise record of today's work, learning and blockers."/>
    {sent && <div className="alert success"><CheckCircle2/> Daily report submitted successfully.</div>}
    <Card>
      <div className="form-grid">
        <label>Today's Work<textarea placeholder="What did you work on?"/></label>
        <label>Completed<textarea placeholder="What did you complete?"/></label>
        <label>Learned<textarea placeholder="What did you learn?"/></label>
        <label>Blockers<textarea placeholder="What problems did you face?"/></label>
        <label className="full">Proof of Work<input placeholder="GitHub / deployment / document / video link"/></label>
      </div>
      <button className="btn btn-primary" onClick={()=>setSent(true)}><Send size={16}/> Submit Daily Report</button>
    </Card>
  </>;
}