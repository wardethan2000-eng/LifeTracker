import { describe, expect, it, vi, beforeEach } from "vitest";

// Email adapter tests — nodemailer is mocked, no other adapter mocks in this file.

const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock }
}));

describe("email-adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    sendMailMock.mockReset().mockResolvedValue({});
    createTransportMock.mockReset().mockReturnValue({ sendMail: sendMailMock });
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user@example.com";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_FROM = "noreply@example.com";
  });

  it("calls sendMail with correct arguments", async () => {
    const { sendEmail } = await import("../src/lib/adapters/email-adapter.js");

    await sendEmail({ to: "test@example.com", subject: "Hello", text: "World" });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "test@example.com",
        subject: "Hello",
        text: "World"
      })
    );
  });

  it("throws when SMTP host/user/pass are missing", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const { sendEmail } = await import("../src/lib/adapters/email-adapter.js");

    await expect(sendEmail({ to: "a@b.com", subject: "x", text: "y" })).rejects.toThrow(
      /SMTP configuration is incomplete/i
    );
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("throws when SMTP_FROM is missing", async () => {
    delete process.env.SMTP_FROM;

    const { sendEmail } = await import("../src/lib/adapters/email-adapter.js");

    await expect(sendEmail({ to: "a@b.com", subject: "x", text: "y" })).rejects.toThrow(/SMTP_FROM/i);
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
