export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; providerId?: string }
  | { ok: false; error: string };

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendEmail({
  to,
  subject,
  text,
}: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof payload?.message === "string"
            ? payload.message
            : `Email provider returned ${response.status}`,
      };
    }

    return {
      ok: true,
      providerId: typeof payload?.id === "string" ? payload.id : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Email request failed",
    };
  }
}
