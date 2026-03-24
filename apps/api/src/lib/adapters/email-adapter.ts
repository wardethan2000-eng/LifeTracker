import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let transporter: Transporter | undefined;

const getTransporter = (): Transporter => {
  if (transporter) {
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP configuration is incomplete. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables."
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user, pass }
  });

  return transporter;
};

export const sendEmail = async (options: SendEmailOptions): Promise<void> => {
  const from = process.env.SMTP_FROM;

  if (!from) {
    throw new Error("SMTP_FROM environment variable is not set.");
  }

  await getTransporter().sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  });
};
