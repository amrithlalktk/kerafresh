import nodemailer from "nodemailer";

// Reads SMTP creds from .env. Until those are set, this logs the email to
// the server console instead of sending it — lets the reset-password flow
// be tested end-to-end locally before any real mail provider is wired up.
function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export async function sendMail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const transport = getTransport();
  if (!transport) {
    console.log(
      `\n[mail] SMTP_HOST not set in .env — logging email instead of sending it.\n` +
        `[mail] To: ${to}\n[mail] Subject: ${subject}\n[mail] Body:\n${text}\n`
    );
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@localhost",
    to,
    subject,
    text,
  });
}
