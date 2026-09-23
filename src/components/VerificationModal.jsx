import { Camera, CheckCircle2, XCircle } from "lucide-react";

export default function VerificationModal({ open, state, onClose, onVerify }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-icon"><Camera size={24}/></div>
        <div className="eyebrow">Presence verification</div>
        <h2>Presence Verification Required</h2>
        <p>Please verify your presence to continue your official work session.</p>
        {state === "VERIFIED" && <div className="result success"><CheckCircle2 size={18}/> Presence Verified</div>}
        {state === "FAILED" && <div className="result danger"><XCircle size={18}/> Verification Failed</div>}
        {state === "UNVERIFIED" && <div className="result warning">Presence Unverified</div>}
        {state !== "VERIFIED" && <div className="camera-box"><Camera size={34}/><span>Face-verification component integration point</span></div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {state !== "VERIFIED" && <button className="btn btn-primary" onClick={onVerify}>Verify Presence</button>}
        </div>
      </div>
    </div>
  );
}