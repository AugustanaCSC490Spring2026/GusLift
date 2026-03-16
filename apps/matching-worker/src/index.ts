import { authenticateRequest } from "./auth";
import { fetchUserAndSchedule, type Env } from "./db";
import { resolveMatchingSlotWithOverride, SlotResolveError } from "./slotResolver";
import { MatchingRoom } from "./durableObjects/MatchingRoom";

export { MatchingRoom };

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const userId = authenticateRequest(request);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
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
      if (e instanceof SlotResolveError) {
        return new Response(
          JSON.stringify({ error: e.message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      if (e instanceof Error && e.name === "AuthError") {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
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
