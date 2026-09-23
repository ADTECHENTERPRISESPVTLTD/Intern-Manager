import { Inbox } from "lucide-react";
export default function EmptyState({ title, description }) {
  return <div className="empty-state"><Inbox size={34}/><h3>{title}</h3><p>{description}</p></div>;
}