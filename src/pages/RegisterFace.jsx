/**
 * TEMPORARY dev-only page so a real person can register their own face against the mock
 * backend through the browser (the real onboarding flow, and where this belongs permanently,
 * is Akanksha's to design — e.g. inside Profile, or a first-run step after login).
 */
import { useNavigate } from "react-router-dom";
import { FaceRegistration } from "../presence-verification";
import { useVerificationStatus } from "../verificationContext";

export default function RegisterFace() {
  const { service, ready } = useVerificationStatus();
  const navigate = useNavigate();
  if (!ready) return <p style={{ padding: 24 }}>Connecting…</p>;
  return (
    <div style={{ maxWidth: 480, margin: "48px auto", padding: "0 16px" }}>
      <FaceRegistration service={service} onRegistered={() => navigate("/")} />
    </div>
  );
}
