import nodemailer from "nodemailer";

type SendInvitationEmailInput = {
  to: string;
  name: string | null;
  role: "TEACHER" | "STUDENT";
  inviteUrl: string;
  inviteExpires: Date;
  details?: Array<{ label: string; value: string }>;
};

type SendStudentVerificationEmailInput = {
  to: string;
  name: string | null;
  verifyUrl: string;
  verifyExpires: Date;
};

function getMailerConfig() {
  const service = (process.env.SMTP_SERVICE ?? "").toLowerCase();
  const isGmail = service === "gmail";
  const host = process.env.SMTP_HOST || (isGmail ? "smtp.gmail.com" : "");
  const port = Number(process.env.SMTP_PORT ?? (isGmail ? "465" : ""));
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
  const from = process.env.MAIL_FROM || user;
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : isGmail;

  if (!host || !Number.isFinite(port) || !from || !user || !pass) {
    throw new Error(
      "Email server is not configured. Set SMTP_USER, SMTP_PASS, MAIL_FROM and either SMTP_SERVICE=gmail or SMTP_HOST/SMTP_PORT."
    );
  }

  return {
    service: isGmail ? "gmail" : undefined,
    host,
    port,
    secure,
    from,
    auth: { user, pass },
  };
}

export async function sendInvitationEmail(input: SendInvitationEmailInput) {
  const config = getMailerConfig();
  const transporter = nodemailer.createTransport({
    service: config.service,
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: config.auth,
  });

  const roleLabel = input.role === "TEACHER" ? "Teacher" : "Student";
  const recipientName = input.name?.trim() || "there";
  const expiresText = input.inviteExpires.toUTCString();
  const details = input.details?.filter((item) => item.value.trim().length > 0) ?? [];
  const detailsText =
    details.length > 0
      ? ["", "Profile details shared by Admin:", ...details.map((item) => `- ${item.label}: ${item.value}`), ""]
      : [];
  const detailsHtml =
    details.length > 0
      ? `<p><strong>Profile details shared by Admin:</strong></p><ul>${details
          .map((item) => `<li><strong>${item.label}:</strong> ${item.value}</li>`)
          .join("")}</ul>`
      : "";

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: `St. Austin Invitation (${roleLabel})`,
    text: [
      `Hi ${recipientName},`,
      "",
      `You have been invited to join St. Austin as a ${roleLabel}.`,
      ...detailsText,
      `Use this link to set your password and activate your account:`,
      input.inviteUrl,
      "",
      `This invitation expires on ${expiresText}.`,
    ].join("\n"),
    html: `
      <p>Hi ${recipientName},</p>
      <p>You have been invited to join <strong>St. Austin</strong> as a <strong>${roleLabel}</strong>.</p>
      ${detailsHtml}
      <p><a href="${input.inviteUrl}">Accept invitation</a></p>
      <p>This invitation expires on ${expiresText}.</p>
    `,
  });
}

export async function sendStudentVerificationEmail(input: SendStudentVerificationEmailInput) {
  const config = getMailerConfig();
  const transporter = nodemailer.createTransport({
    service: config.service,
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: config.auth,
  });

  const recipientName = input.name?.trim() || "there";
  const expiresText = input.verifyExpires.toUTCString();

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: "Verify your St. Austin student account",
    text: [
      `Hi ${recipientName},`,
      "",
      "Thanks for registering for St. Austin.",
      "Please verify your email to activate your student account:",
      input.verifyUrl,
      "",
      `This link expires on ${expiresText}.`,
    ].join("\n"),
    html: `
      <p>Hi ${recipientName},</p>
      <p>Thanks for registering for <strong>St. Austin</strong>.</p>
      <p>Please verify your email to activate your student account.</p>
      <p><a href="${input.verifyUrl}">Verify email</a></p>
      <p>This link expires on ${expiresText}.</p>
    `,
  });
}
