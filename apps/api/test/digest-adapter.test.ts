import { describe, expect, it, vi, beforeEach } from "vitest";

// Digest adapter tests — email-adapter is mocked.

const sendEmailMock = vi.fn();

vi.mock("../src/lib/adapters/email-adapter.js", () => ({
  sendEmail: sendEmailMock
}));

// Dynamic import after mock registration
const { sendDigest } = await import("../src/lib/adapters/digest-adapter.js");

describe("digest-adapter", () => {
  beforeEach(() => {
    sendEmailMock.mockReset().mockResolvedValue(undefined);
  });

  it("sends one email containing all 3 entries", async () => {
    await sendDigest({
      to: "user@example.com",
      userName: "Alice",
      entries: [
        { title: "Oil change due", body: "Your car needs an oil change." },
        { title: "Filter overdue", body: "Air filter is overdue." },
        { title: "Low stock", body: "Motor oil is low." }
      ]
    });

    expect(sendEmailMock).toHaveBeenCalledOnce();
    const call = sendEmailMock.mock.calls[0][0] as { to: string; subject: string; text: string };
    expect(call.to).toBe("user@example.com");
    expect(call.text).toContain("Oil change due");
    expect(call.text).toContain("Filter overdue");
    expect(call.text).toContain("Low stock");
  });

  it("does not send email when entries is empty", async () => {
    await sendDigest({ to: "user@example.com", userName: "Bob", entries: [] });

    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
