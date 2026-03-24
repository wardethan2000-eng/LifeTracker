import { sendEmail } from "./email-adapter.js";

export interface DigestEntry {
  title: string;
  body: string;
}

export interface SendDigestOptions {
  to: string;
  userName: string;
  entries: DigestEntry[];
}

export const sendDigest = async (options: SendDigestOptions): Promise<void> => {
  if (options.entries.length === 0) {
    return;
  }

  const lines = options.entries.map((e, i) => `${i + 1}. ${e.title}\n   ${e.body}`);
  const text = [
    `Hi ${options.userName},`,
    "",
    "Here is your daily LifeKeeper digest:",
    "",
    ...lines,
    "",
    "Log in to take action on any of these items."
  ].join("\n");

  await sendEmail({
    to: options.to,
    subject: "Your LifeKeeper daily digest",
    text
  });
};
