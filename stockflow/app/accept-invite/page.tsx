import { AcceptInviteForm } from "./AcceptInviteForm";

export default function AcceptInvitePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-main)",
          padding: "40px",
          width: "100%",
          maxWidth: "440px",
        }}
      >
        <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "12px" }}>
          Accept StockFlow invitation
        </h1>
        <p style={{ color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "24px" }}>
          Enter the email address and invitation code from your email. You will then
          create your password.
        </p>

        <AcceptInviteForm />
      </div>
    </div>
  );
}
