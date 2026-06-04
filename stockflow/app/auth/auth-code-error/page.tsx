"use client";

import Link from "next/link";

export default function AuthCodeErrorPage() {
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
          Invitation link expired
        </h1>
        <p style={{ color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "16px" }}>
          The email link is invalid, has expired, or has already been used.
        </p>
        <p style={{ color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "24px" }}>
          Ask your StockFlow administrator to select <strong>Resend invite</strong> on the Users
          page, then use only the newest email.
        </p>
        <Link href="/login" className="btn btn-primary">
          Back to login
        </Link>
      </div>
    </div>
  );
}
