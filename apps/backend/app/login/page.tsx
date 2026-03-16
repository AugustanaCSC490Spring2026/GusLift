"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: any;
  }
}

const SCHOOL_DOMAIN = "augustana.edu";

type GoogleProfile = {
  id: string;
  email: string;
  name?: string;
  picture?: string;
};

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function GoogleLoginPage() {
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID_WEB;

  useEffect(() => {
    if (!clientId) {
      setError(
        "Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID_WEB in the backend env file."
      );
      setInitializing(false);
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      if ((window as any).google) {
        setupGoogle();
      } else {
        existing.addEventListener("load", setupGoogle, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = setupGoogle;
    script.onerror = () => {
      setError("Failed to load Google sign-in script.");
      setInitializing(false);
    };
    document.head.appendChild(script);

    function setupGoogle() {
      try {
        if (!window.google?.accounts?.id) {
          setError("Google identity API not available in window.");
          setInitializing(false);
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            const payload = decodeJwtPayload(response.credential);
            if (!payload) {
              setError("Could not decode ID token from Google.");
              return;
            }

            const email = String(payload.email || "").toLowerCase();
            if (!email.endsWith("@" + SCHOOL_DOMAIN)) {
              setError(
                `This tool is limited to ${SCHOOL_DOMAIN} accounts. Got: ${email}`
              );
              setProfile(null);
              return;
            }

            setError(null);
            setProfile({
              id: String(payload.sub || ""),
              email,
              name: payload.name,
              picture: payload.picture,
            });
          },
          auto_select: false,
        });

        const buttonDiv = document.getElementById("google-signin-button");
        if (buttonDiv) {
          window.google.accounts.id.renderButton(buttonDiv, {
            type: "standard",
            theme: "outline",
            size: "large",
            shape: "pill",
            text: "continue_with",
          });
        }

        setInitializing(false);
      } catch (err) {
        console.error("Google init error", err);
        setError("Error initializing Google sign-in.");
        setInitializing(false);
      }
    }
  }, [clientId]);

  const userId = profile?.id ?? "";
  const registerUrl = userId ? `/register?userId=${encodeURIComponent(userId)}` : "/register";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top, #1d283a 0, #020617 45%, #000 100%)",
        padding: 24,
        color: "#e5e7eb",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background:
            "radial-gradient(circle at top left, #020617 0, #020617 30%, #000 100%)",
          borderRadius: 18,
          border: "1px solid rgba(148,163,184,0.15)",
          boxShadow:
            "0 24px 80px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.9)",
          padding: 22,
        }}
      >
        <header style={{ marginBottom: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                Google sign‑in helper
              </div>
              <p
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "#9ca3af",
                }}
              >
                Sign in with your Augustana Google account to grab the{" "}
                <code>user.id</code> for seeding GusLift.
              </p>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                borderRadius: 999,
                border: "1px solid rgba(34,197,94,0.5)",
                background: "rgba(22,101,52,0.45)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#9ca3af",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: "#22c55e",
                  boxShadow: "0 0 10px rgba(34,197,94,0.9)",
                }}
              />
              Test only
            </span>
          </div>
        </header>

        {!clientId ? (
          <p style={{ fontSize: 13, color: "#fca5a5" }}>
            Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID_WEB</code> in{" "}
            <code>apps/backend/.env.local</code> (or your backend env file) and
            restart <code>npm run dev</code>.
          </p>
        ) : (
          <>
            <div
              id="google-signin-button"
              style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}
            />

            {initializing && (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                Preparing Google sign‑in…
              </p>
            )}

            {error && (
              <p style={{ fontSize: 13, color: "#fca5a5", marginTop: 4 }}>
                {error}
              </p>
            )}

            {profile && !error && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(34,197,94,0.6)",
                  background: "rgba(22,101,52,0.4)",
                  fontSize: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {profile.picture && (
                    <img
                      src={profile.picture}
                      alt={profile.name || profile.email}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        border: "1px solid rgba(15,23,42,0.9)",
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontWeight: 500 }}>{profile.name}</div>
                    <div style={{ fontSize: 11, color: "#d1d5db" }}>
                      {profile.email}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.16em",
                      color: "#9ca3af",
                      marginBottom: 4,
                    }}
                  >
                    Google user id
                  </div>
                  <code
                    style={{
                      display: "block",
                      padding: "6px 8px",
                      borderRadius: 8,
                      background: "rgba(15,23,42,0.95)",
                      border: "1px solid rgba(37,99,235,0.9)",
                      fontSize: 11,
                      wordBreak: "break-all",
                    }}
                  >
                    {userId}
                  </code>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!userId) return;
                      navigator.clipboard
                        .writeText(userId)
                        .catch(() => undefined);
                    }}
                    style={{
                      borderRadius: 999,
                      border: "1px solid rgba(148,163,184,0.5)",
                      padding: "6px 12px",
                      fontSize: 12,
                      background:
                        "radial-gradient(circle at top left, #020617 0, #020617 75%)",
                      color: "#e5e7eb",
                      cursor: userId ? "pointer" : "default",
                      opacity: userId ? 1 : 0.5,
                    }}
                  >
                    Copy id
                  </button>

                  <a
                    href={registerUrl}
                    style={{
                      borderRadius: 999,
                      border: "none",
                      padding: "7px 14px",
                      fontSize: 12,
                      textDecoration: "none",
                      color: "#020617",
                      background:
                        "linear-gradient(135deg, #22c55e, #a3e635)",
                      boxShadow:
                        "0 14px 40px rgba(22,163,74,0.65), 0 0 0 1px rgba(21,128,61,0.9)",
                    }}
                  >
                    Open /register with id
                  </a>
                </div>
              </div>
            )}

            <p
              style={{
                marginTop: 14,
                fontSize: 11,
                color: "#9ca3af",
                lineHeight: 1.5,
              }}
            >
              After signing in, copy the Google user id (the <code>sub</code>{" "}
              claim) or click{" "}
              <code>Open /register with id</code> to pre-fill the registration
              form. This is the same identifier you&apos;ll store in your own
              database and pass into the matching worker.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

