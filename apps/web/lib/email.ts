import "server-only";

/**
 * Model-agnostic email wrapper — same swappable-backend, graceful-degradation
 * pattern as apps/ai-service's LLMClient/EmbeddingClient (Phase 5/6): callers
 * never touch the provider directly, and tests inject a fake backend instead
 * of hitting the network. Talks to Resend's REST API directly over fetch
 * rather than pulling in an SDK, for the same reason Voyage AI is called
 * directly — a REST POST doesn't need a wrapper library.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailBackend {
  send(message: EmailMessage): Promise<void>;
}

export class ResendBackend implements EmailBackend {
  constructor(
    private readonly apiKey: string,
    private readonly from = "WealthPilot Alerts <alerts@wealthpilot.app>",
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }
  }
}

export class EmailClient {
  private readonly backend: EmailBackend | null;

  constructor(backend?: EmailBackend | null) {
    this.backend = backend !== undefined ? backend : makeDefaultBackend();
  }

  get configured(): boolean {
    return this.backend !== null;
  }

  /** No-ops (with a log line) when unconfigured, rather than throwing —
   * budget-alert evaluation shouldn't fail just because email isn't set up. */
  async send(message: EmailMessage): Promise<void> {
    if (!this.backend) {
      console.log(`[email not configured] would send "${message.subject}" to ${message.to}`);
      return;
    }
    await this.backend.send(message);
  }
}

function makeDefaultBackend(): EmailBackend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new ResendBackend(apiKey);
}
