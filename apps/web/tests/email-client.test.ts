import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailClient, type EmailBackend, type EmailMessage } from "@/lib/email";

class RecordingBackend implements EmailBackend {
  sent: EmailMessage[] = [];
  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe("EmailClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is not configured without RESEND_API_KEY", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const client = new EmailClient();
    expect(client.configured).toBe(false);
  });

  it("delegates to an injected backend", async () => {
    const backend = new RecordingBackend();
    const client = new EmailClient(backend);

    expect(client.configured).toBe(true);
    await client.send({ to: "user@example.test", subject: "Over budget", html: "<p>hi</p>" });

    expect(backend.sent).toEqual([
      { to: "user@example.test", subject: "Over budget", html: "<p>hi</p>" },
    ]);
  });

  it("no-ops instead of throwing when unconfigured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const client = new EmailClient();

    await expect(
      client.send({ to: "user@example.test", subject: "hi", html: "<p>hi</p>" }),
    ).resolves.toBeUndefined();
  });
});
