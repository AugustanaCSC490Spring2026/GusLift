import { authenticateRequest } from "./auth";
import { fetchUserAndSchedule, type Env } from "./db";
import { MatchingRoom } from "./durableObjects/MatchingRoom";
import {
  ManualSlotRequiredError,
  resolveMatchingSlotWithOverride,
  SlotResolveError,
} from "./slotResolver";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export { MatchingRoom };

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const userId = authenticateRequest(request);
    if (!userId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const isWebSocket =
      request.headers.get("Upgrade")?.toLowerCase() === "websocket";

    // JSON preflight so mobile can detect manual-time flow before opening a WebSocket.
    if (request.method === "GET" && !isWebSocket) {
      try {
        const { residence, schedule } = await fetchUserAndSchedule(env, userId);
        const url = new URL(request.url);
        const slot = resolveMatchingSlotWithOverride(schedule, residence, {
          location: url.searchParams.get("location"),
          time: url.searchParams.get("time"),
          day: url.searchParams.get("day"),
        });
        return json({ ok: true, slot });
      } catch (e) {
        if (e instanceof ManualSlotRequiredError) {
          return json({
            ok: false,
            needsManualTime: true,
            message: e.message,
          });
        }
        if (e instanceof SlotResolveError) {
          return json({ ok: false, error: e.message }, 400);
        }
        if (e instanceof Error && e.name === "AuthError") {
          return json({ error: e.message }, 401);
        }
        throw e;
      }
    }

    let slot: string;
    try {
      const { residence, schedule } = await fetchUserAndSchedule(env, userId);
      const url = new URL(request.url);
      slot = resolveMatchingSlotWithOverride(schedule, residence, {
        location: url.searchParams.get("location"),
        time: url.searchParams.get("time"),
        day: url.searchParams.get("day"),
      });
    } catch (e) {
      if (e instanceof ManualSlotRequiredError) {
        return json(
          {
            ok: false,
            needsManualTime: true,
            message: e.message,
          },
          422
        );
      }
      if (e instanceof SlotResolveError) {
        return json({ ok: false, error: e.message }, 400);
      }
      if (e instanceof Error && e.name === "AuthError") {
        return json({ error: e.message }, 401);
      }
      throw e;
    }

    const id = env.MATCHING_ROOM.idFromName(slot);
    const stub = env.MATCHING_ROOM.get(id);

    const forwardedRequest = new Request(request.url, {
      method: request.method,
      headers: (() => {
        const h = new Headers(request.headers);
        h.set("X-User-Id", userId);
        h.set("X-Slot-Key", slot);
        return h;
      })(),
    });

    return stub.fetch(forwardedRequest);
  },
};
