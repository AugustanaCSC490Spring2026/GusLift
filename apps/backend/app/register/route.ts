import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const userIdParam = url.searchParams.get("userId") ?? "";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GusLift Test Registration</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0f172a;
        --bg-alt: #020617;
        --card: #020617;
        --card-border: #1e293b;
        --accent: #22c55e;
        --accent-soft: rgba(34,197,94,0.12);
        --accent-muted: #16a34a;
        --text: #e5e7eb;
        --text-muted: #9ca3af;
        --danger: #f97373;
        --danger-soft: rgba(248,113,113,0.1);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
          "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, #1d283a 0, #020617 45%, #000 100%);
        color: var(--text);
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .shell {
        width: 100%;
        max-width: 980px;
        display: grid;
        grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.4fr);
        gap: 24px;
      }

      @media (max-width: 900px) {
        .shell {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      .panel {
        background: radial-gradient(circle at top left, #020617 0, #020617 30%, #000 100%);
        border-radius: 18px;
        border: 1px solid rgba(148, 163, 184, 0.15);
        box-shadow:
          0 24px 80px rgba(15, 23, 42, 0.9),
          0 0 0 1px rgba(15, 23, 42, 0.9);
        padding: 22px 22px 20px;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 18px;
      }

      .title {
        font-size: 18px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      .title span {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(34, 197, 94, 0.5);
        background: rgba(22, 101, 52, 0.45);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-muted);
      }

      .title span::before {
        content: "";
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 10px rgba(34, 197, 94, 0.9);
      }

      .subtitle {
        font-size: 13px;
        color: var(--text-muted);
        margin-top: 6px;
      }

      .pill-row {
        display: inline-flex;
        gap: 8px;
        margin-top: 14px;
        flex-wrap: wrap;
      }

      .pill {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        color: var(--text-muted);
      }

      .pill--accent {
        border-color: rgba(34, 197, 94, 0.7);
        background: linear-gradient(
          135deg,
          rgba(34, 197, 94, 0.15),
          rgba(56, 189, 248, 0.1)
        );
        color: #bbf7d0;
      }

      form {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 16px;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .field--full {
        grid-column: 1 / -1;
      }

      .label-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: var(--text-muted);
      }

      .hint {
        font-size: 11px;
        color: var(--text-muted);
        opacity: 0.9;
      }

      input[type="text"],
      input[type="number"],
      textarea,
      select {
        width: 100%;
        border-radius: 10px;
        border: 1px solid rgba(51, 65, 85, 0.8);
        background: radial-gradient(circle at top left, #020617, #020617);
        color: var(--text);
        padding: 8px 10px;
        font-size: 13px;
        outline: none;
        transition:
          border-color 120ms ease-out,
          box-shadow 120ms ease-out,
          background-color 120ms ease-out;
      }

      input[type="text"]:focus,
      input[type="number"]:focus,
      textarea:focus,
      select:focus {
        border-color: rgba(34, 197, 94, 0.9);
        box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.7);
      }

      input::placeholder,
      textarea::placeholder {
        color: rgba(148, 163, 184, 0.6);
      }

      textarea {
        min-height: 88px;
        resize: vertical;
      }

      input[type="file"] {
        font-size: 12px;
        color: var(--text-muted);
      }

      .switcher {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(30, 64, 175, 0.7);
        padding: 3px;
        gap: 3px;
      }

      .switcher button {
        border: none;
        background: transparent;
        color: var(--text-muted);
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        padding: 6px 10px;
        border-radius: 999px;
        cursor: pointer;
        transition:
          background 120ms ease-out,
          color 120ms ease-out,
          box-shadow 120ms ease-out;
      }

      .switcher button[data-active="true"] {
        background: linear-gradient(
          135deg,
          rgba(34, 197, 94, 0.16),
          rgba(56, 189, 248, 0.15)
        );
        color: #e5e7eb;
        box-shadow:
          0 0 0 1px rgba(34, 197, 94, 0.7),
          0 10px 25px rgba(15, 23, 42, 0.9);
      }

      .switcher button:disabled {
        opacity: 0.65;
        cursor: default;
      }

      .footer-row {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 4px;
        gap: 10px;
      }

      .button-row {
        display: flex;
        gap: 8px;
      }

      button.primary {
        border-radius: 999px;
        border: none;
        padding: 8px 18px;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        color: #020617;
        background: linear-gradient(135deg, #22c55e, #a3e635);
        box-shadow:
          0 14px 40px rgba(22, 163, 74, 0.65),
          0 0 0 1px rgba(21, 128, 61, 0.9);
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition:
          transform 80ms ease-out,
          box-shadow 80ms ease-out,
          filter 80ms ease-out;
      }

      button.primary:hover {
        transform: translateY(-1px);
        filter: saturate(1.1);
      }

      button.primary:active {
        transform: translateY(0);
        box-shadow:
          0 10px 25px rgba(22, 163, 74, 0.5),
          0 0 0 1px rgba(21, 128, 61, 0.9);
      }

      button.primary[disabled] {
        opacity: 0.65;
        cursor: default;
        box-shadow: none;
      }

      .secondary-link {
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        padding: 7px 13px;
        font-size: 12px;
        text-decoration: none;
        color: var(--text-muted);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: radial-gradient(circle at top left, #020617 0, #020617 75%);
      }

      .secondary-link span {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
      }

      .secondary-link code {
        font-size: 11px;
        background: rgba(15, 23, 42, 0.95);
        padding: 3px 7px;
        border-radius: 6px;
        border: 1px solid rgba(30, 64, 175, 0.9);
        color: #e5e7eb;
      }

      .small-text {
        font-size: 11px;
        color: var(--text-muted);
      }

      .status {
        font-size: 12px;
        margin-top: 4px;
      }

      .status span {
        padding: 4px 6px;
        border-radius: 7px;
      }

      .status--ok span {
        background: var(--accent-soft);
        color: #bbf7d0;
        border: 1px solid rgba(34, 197, 94, 0.8);
      }

      .status--error span {
        background: var(--danger-soft);
        color: #fecaca;
        border: 1px solid rgba(248, 113, 113, 0.8);
      }

      .status--idle span {
        border: 1px dashed rgba(148, 163, 184, 0.4);
        color: var(--text-muted);
        background: rgba(15, 23, 42, 0.7);
      }

      .log {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
          "Liberation Mono", "Courier New", monospace;
        font-size: 11px;
        background: radial-gradient(circle at top, #020617, #020617 55%, #000);
        border-radius: 14px;
        border: 1px solid rgba(30, 64, 175, 0.9);
        padding: 12px 11px;
        min-height: 120px;
        max-height: 260px;
        overflow: auto;
        color: rgba(209, 213, 219, 0.9);
      }

      .log-entry {
        margin-bottom: 6px;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .log-entry:last-child {
        margin-bottom: 0;
      }

      .badge-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        gap: 10px;
      }

      .badge-row .left {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .badge-row .label {
        font-size: 10px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .pill-mini {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 9px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.4);
        font-size: 11px;
        color: var(--text-muted);
      }

      .pill-mini strong {
        font-weight: 500;
        color: #e5e7eb;
      }

      .muted {
        opacity: 0.7;
      }

      .divider {
        height: 1px;
        background: linear-gradient(
          to right,
          transparent,
          rgba(148, 163, 184, 0.4),
          transparent
        );
        margin: 10px 0 12px;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="panel">
        <header class="panel-header">
          <div>
            <div class="title">
              GusLift Manual Seeder
              <span>Lab only</span>
            </div>
            <div class="subtitle">
              Quickly register test riders &amp; drivers against
              <code>/api/rider</code> and <code>/api/driver</code> using a
              Google user id.
            </div>
            <div class="pill-row">
              <div class="pill pill--accent">Next.js API route</div>
              <div class="pill">Schedule JSON friendly</div>
            </div>
          </div>
          <div class="switcher" id="roleSwitcher">
            <button type="button" data-role="rider" data-active="true">
              Rider
            </button>
            <button type="button" data-role="driver" data-active="false">
              Driver
            </button>
          </div>
        </header>

        <form id="seedForm" autocomplete="off">
          <input type="hidden" name="is_driver" id="isDriverInput" value="false" />

          <div class="field field--full">
            <div class="label-row">
              <label for="userID">Google user id</label>
              <span class="hint">Paste the Google <code>sub</code> / user id from your GCP auth logs</span>
            </div>
            <input
              id="userID"
              name="userID"
              type="text"
              required
              placeholder="e.g. google-oauth2|1234567890abcdef"
              value="${userIdParam.replace(/"/g, "&quot;")}"
            />
          </div>

          <div class="field">
            <label for="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Jane Doe"
            />
          </div>

          <div class="field">
            <label for="residence">Residence / home base</label>
            <input
              id="residence"
              name="residence"
              type="text"
              placeholder="Kigali, Gacuriro"
            />
          </div>

          <div class="field field--full">
            <div class="label-row">
              <label for="picture">Profile picture (optional)</label>
              <span class="hint">Stored in <code>driver-pictures</code> bucket</span>
            </div>
            <input id="picture" name="picture" type="file" accept="image/*" />
          </div>

          <div class="field field--full">
            <div class="label-row">
              <label>Weekly schedule</label>
              <span class="hint">
                Only <code>tue</code> and <code>wed</code> are exposed here; we&apos;ll
                build the JSON for you.
              </span>
            </div>
            <div
              style="
                display: grid;
                grid-template-columns: auto 1fr 1fr;
                gap: 8px 10px;
                align-items: center;
              "
            >
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-muted);">
                Day
              </div>
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-muted);">
                Start time
              </div>
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--text-muted);">
                End time
              </div>

              <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text);">
                <input type="checkbox" id="tueEnabled" />
                Tue
              </label>
              <select id="tueStart">
                <option value="">Select start</option>
              </select>
              <select id="tueEnd">
                <option value="">Select end</option>
              </select>

              <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text);">
                <input type="checkbox" id="wedEnabled" />
                Wed
              </label>
              <select id="wedStart">
                <option value="">Select start</option>
              </select>
              <select id="wedEnd">
                <option value="">Select end</option>
              </select>
            </div>
          </div>

          <div id="riderFields">
            <div class="field">
              <label for="pickup_loc">Pickup location</label>
              <input
                id="pickup_loc"
                name="pickup_loc"
                type="text"
                placeholder="e.g. Erikson Hall"
              />
            </div>
            <div class="field">
              <label for="dropoff_loc">Dropoff location</label>
              <input
                id="dropoff_loc"
                name="dropoff_loc"
                type="text"
                placeholder="e.g. Olin Hall"
              />
            </div>
          </div>

          <div id="driverFields" style="display: none;">
            <div class="field">
              <label for="make">Car make</label>
              <input
                id="make"
                name="make"
                type="text"
                placeholder="Toyota"
              />
            </div>
            <div class="field">
              <label for="model">Car model</label>
              <input
                id="model"
                name="model"
                type="text"
                placeholder="RAV4"
              />
            </div>
            <div class="field">
              <label for="color">Color</label>
              <input
                id="color"
                name="color"
                type="text"
                placeholder="Midnight blue"
              />
            </div>
            <div class="field">
              <label for="license_plate">License plate</label>
              <input
                id="license_plate"
                name="license_plate"
                type="text"
                placeholder="RAB 123 C"
              />
            </div>
            <div class="field">
              <label for="capacity">Capacity</label>
              <input
                id="capacity"
                name="capacity"
                type="number"
                min="1"
                max="8"
                placeholder="4"
              />
            </div>
          </div>

          <div class="footer-row">
            <div class="small-text">
              Data is written to <code>User</code>, <code>Car</code> (drivers only)
              and <code>schedule</code>.
            </div>
            <div class="button-row">
              <button type="submit" class="primary">
                <span id="submitLabel">Register rider</span>
                <span aria-hidden="true">⇢</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      <aside class="panel">
        <div class="badge-row">
          <div class="left">
            <div class="label">Result</div>
            <div class="pill-mini">
              <span class="muted">Target</span>
              <strong id="targetPath">/api/rider</strong>
            </div>
          </div>
          <a
            id="targetLink"
            class="secondary-link"
            href="/api/rider"
            target="_blank"
            rel="noreferrer"
          >
            <span>Open endpoint</span>
            <code id="targetEndpointCode">POST /api/rider</code>
          </a>
        </div>

        <div class="divider"></div>

        <div id="status" class="status status--idle">
          <span>Waiting to send a request.</span>
        </div>

        <div class="log" id="log"></div>

        <p class="small-text" style="margin-top: 10px;">
          This UI does not perform any authentication. It simply forwards the
          Google user id and schedule details to your backend API route,
          which uses the database client to upsert into <code>User</code>,
          <code>Car</code> and <code>schedule</code>. Perfect for seeding test
          data before running the matching worker.
        </p>
      </aside>
    </main>

    <script>
      (function () {
        const roleSwitcher = document.getElementById("roleSwitcher");
        const isDriverInput = document.getElementById("isDriverInput");
        const riderFields = document.getElementById("riderFields");
        const driverFields = document.getElementById("driverFields");
        const targetPath = document.getElementById("targetPath");
        const targetLink = document.getElementById("targetLink");
        const targetEndpointCode = document.getElementById("targetEndpointCode");
        const submitLabel = document.getElementById("submitLabel");
        const form = document.getElementById("seedForm");
        const status = document.getElementById("status");
        const log = document.getElementById("log");

        let currentRole = "rider";

        function buildTimeSlots(stepMinutes = 15) {
          const values = [];
          for (let total = 0; total < 24 * 60; total += stepMinutes) {
            const hh = String(Math.floor(total / 60)).padStart(2, "0");
            const mm = String(total % 60).padStart(2, "0");
            values.push(hh + ":" + mm);
          }
          return values;
        }

        function hydrateTimeSelect(selectId, options) {
          const select = document.getElementById(selectId);
          if (!select) return;
          options.forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
          });
        }

        const timeSlots = buildTimeSlots(15);
        ["tueStart", "tueEnd", "wedStart", "wedEnd"].forEach((id) => {
          hydrateTimeSelect(id, timeSlots);
        });

        function setRole(role) {
          currentRole = role;
          const buttons = roleSwitcher.querySelectorAll("button");
          buttons.forEach((btn) => {
            const active = btn.getAttribute("data-role") === role;
            btn.setAttribute("data-active", active ? "true" : "false");
          });

          const isDriver = role === "driver";
          isDriverInput.value = isDriver ? "true" : "false";
          riderFields.style.display = isDriver ? "none" : "grid";
          driverFields.style.display = isDriver ? "grid" : "none";
          submitLabel.textContent = isDriver ? "Register driver" : "Register rider";
          targetPath.textContent = isDriver ? "/api/driver" : "/api/rider";
          targetLink.href = isDriver ? "/api/driver" : "/api/rider";
          targetEndpointCode.textContent = isDriver
            ? "POST /api/driver"
            : "POST /api/rider";

          setStatus(
            "idle",
            isDriver
              ? "Ready to create / update a driver + car + schedule row."
              : "Ready to create / update a rider + schedule row."
          );
        }

        function setStatus(kind, message) {
          status.className = "status status--" + kind;
          status.innerHTML = "<span>" + message + "</span>";
        }

        function appendLogEntry(label, payload) {
          const entry = document.createElement("div");
          entry.className = "log-entry";
          const time = new Date().toLocaleTimeString();
          let text = "[" + time + "] " + label;
          if (payload !== undefined) {
            try {
              text += "\\n" + JSON.stringify(payload, null, 2);
            } catch {
              text += "\\n" + String(payload);
            }
          }
          entry.textContent = text;
          log.appendChild(entry);
          log.scrollTop = log.scrollHeight;
        }

        roleSwitcher.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const role = target.getAttribute("data-role");
          if (!role || role === currentRole) return;
          setRole(role);
        });

        form.addEventListener("submit", async (event) => {
          event.preventDefault();

          const userId = (document.getElementById("userID").value || "").trim();
          if (!userId) {
            setStatus("error", "Google user id is required.");
            appendLogEntry("Validation error", { field: "userID" });
            return;
          }

          const tueEnabled = document.getElementById("tueEnabled").checked;
          const wedEnabled = document.getElementById("wedEnabled").checked;

          const days = {};

          if (tueEnabled) {
            const start = (document.getElementById("tueStart").value || "").trim();
            const end = (document.getElementById("tueEnd").value || "").trim();
            if (!start || !end) {
              setStatus("error", "For Tuesday, both start and end time must be set.");
              appendLogEntry("Invalid Tuesday schedule", { start, end });
              return;
            }
            days["tue"] = { start_time: start, end_time: end };
          }

          if (wedEnabled) {
            const start = (document.getElementById("wedStart").value || "").trim();
            const end = (document.getElementById("wedEnd").value || "").trim();
            if (!start || !end) {
              setStatus("error", "For Wednesday, both start and end time must be set.");
              appendLogEntry("Invalid Wednesday schedule", { start, end });
              return;
            }
            days["wed"] = { start_time: start, end_time: end };
          }

          const submitBtn = form.querySelector('button[type="submit"]');
          submitBtn.disabled = true;

          const fd = new FormData(form);
          const dayKeys = Object.keys(days);
          const isDriver = currentRole === "driver";

          try {
            let res;
            if (isDriver) {
              if (dayKeys.length > 0) {
                fd.set("days", JSON.stringify(days));
              } else {
                fd.delete("days");
              }

              setStatus("idle", "Sending request to /api/driver …");
              appendLogEntry("Sending FormData to /api/driver", {
                role: currentRole,
                userID: userId,
              });

              res = await fetch("/api/driver", {
                method: "POST",
                body: fd,
              });
            } else {
              const name = (document.getElementById("name").value || "").trim();
              const residence = (document.getElementById("residence").value || "").trim();
              const pickup_loc = (document.getElementById("pickup_loc").value || "").trim();
              const dropoff_loc = (document.getElementById("dropoff_loc").value || "").trim();

              if (!name || !residence || dayKeys.length === 0 || !pickup_loc || !dropoff_loc) {
                setStatus(
                  "error",
                  "Rider registration requires name, residence, pickup, dropoff, and at least one schedule day."
                );
                appendLogEntry("Validation error", {
                  name: Boolean(name),
                  residence: Boolean(residence),
                  pickup_loc: Boolean(pickup_loc),
                  dropoff_loc: Boolean(dropoff_loc),
                  hasSchedule: dayKeys.length > 0,
                });
                return;
              }

              setStatus("idle", "Sending request to /api/rider …");
              appendLogEntry("Sending JSON to /api/rider", {
                role: currentRole,
                userID: userId,
              });

              const payload = {
                userID: userId,
                name,
                residence,
                days,
                pickup_loc,
                dropoff_loc,
              };

              res = await fetch("/api/rider", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
            }

            const contentType = res.headers.get("content-type") || "";
            let body;
            if (contentType.includes("application/json")) {
              body = await res.json();
            } else {
              body = await res.text();
            }

            if (res.ok) {
              setStatus(
                "ok",
                "Success: upserted records for user " + userId + "."
              );
              appendLogEntry("Success response", body);
            } else {
              setStatus(
                "error",
                "Request failed with status " + res.status + ". See log."
              );
              appendLogEntry("Error response", body);
            }
          } catch (err) {
            setStatus(
              "error",
              "Network or server error. See log for details."
            );
            appendLogEntry("Fetch error", String(err));
          } finally {
            submitBtn.disabled = false;
          }
        });

        // Initial state
        setRole("rider");
      })();
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

