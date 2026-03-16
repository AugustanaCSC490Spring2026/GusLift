# Ride Matching System -- Implementation Guide for Cursor

This document converts the architecture discussion into concrete
implementation steps so Cursor can implement the system with minimal
ambiguity.

Target stack assumptions: - Cloudflare Workers - Cloudflare Durable
Objects - WebSockets - Postgres / Supabase - React / React Native
frontend

The goal is to build a real-time ride matching engine.

------------------------------------------------------------------------

# 1. Core Concept

Each matching group is a Durable Object instance representing:

location + day + start_time

Example key:

AUGIE:mon:08:00

This Durable Object becomes a live matching room where: - drivers go
online - riders request rides - drivers select riders - riders accept
matches - seats decrement - confirmed rides are written to the database

------------------------------------------------------------------------

# 2. Project Structure

Recommended Worker structure:

/worker index.ts router.ts slotResolver.ts db.ts

/durableObjects MatchingRoom.ts

/types events.ts state.ts

------------------------------------------------------------------------

# 3. Worker Responsibilities

The Worker acts as a router.

Responsibilities: 1. Authenticate user 2. Determine the correct matching
slot 3. Route requests to the correct Durable Object 4. Forward
WebSocket connections

------------------------------------------------------------------------

# 4. Slot Resolver Logic

Create a utility:

slotResolver.ts

Function:

resolveMatchingSlot(user)

Steps: 1. Fetch schedule from DB 2. Determine today's weekday 3. Extract
today's start_time 4. Fetch from_location 5. Generate slot key

Example return value:

AUGIE:mon:08:00

Example implementation:

``` ts
export function resolveMatchingSlot(schedule, location) {
  const day = getCurrentWeekday()
  const startTime = schedule[day].start_time
  return `${location}:${day}:${startTime}`
}
```

------------------------------------------------------------------------

# 5. Worker Routing Logic

Worker entry point:

``` ts
export default {
  async fetch(request, env) {

    const user = await authenticate(request)

    const slot = await resolveMatchingSlot(user.schedule, user.location)

    const id = env.MATCHING_ROOM.idFromName(slot)

    const stub = env.MATCHING_ROOM.get(id)

    return stub.fetch(request)
  }
}
```

If the Durable Object does not exist yet, Cloudflare automatically
creates it.

------------------------------------------------------------------------

# 6. Durable Object: MatchingRoom

File:

/durableObjects/MatchingRoom.ts

This class manages real-time matching state.

State variables:

drivers riders_waiting pending_matches connections

Example structure:

``` ts
drivers = Map<driver_id, { seats_remaining }>

riders_waiting = Array<{
    rider_id
    joined_at
}>

pending_matches = Map<rider_id, driver_id>

connections = Map<user_id, WebSocket>
```

------------------------------------------------------------------------

# 7. WebSocket Handling

When a user opens the matching screen, they connect via WebSocket.

Worker forwards socket to DO.

Inside Durable Object:

``` ts
async fetch(request) {

  if (request.headers.get("Upgrade") === "websocket") {

    const pair = new WebSocketPair()

    const client = pair[0]
    const server = pair[1]

    server.accept()

    this.handleConnection(server)

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

}
```

------------------------------------------------------------------------

# 8. Register Connection

``` ts
handleConnection(ws, userId) {

  this.connections.set(userId, ws)

  ws.addEventListener("close", () => {
    this.connections.delete(userId)
  })

}
```

------------------------------------------------------------------------

# 9. Broadcast Utility

``` ts
broadcast(message) {

  const payload = JSON.stringify(message)

  for (const ws of this.connections.values()) {
    ws.send(payload)
  }

}
```

------------------------------------------------------------------------

# 10. Driver Online Event

Event type:

driver_online

Message example:

``` json
{
  "type": "driver_online",
  "driver_id": "d1",
  "seats": 3
}
```

DO logic:

drivers.set(driver_id, { seats_remaining: seats })

Broadcast:

driver_joined

------------------------------------------------------------------------

# 11. Rider Request Event

Event:

rider_request

Example:

``` json
{
  "type": "rider_request",
  "rider_id": "r1"
}
```

DO logic:

riders_waiting.push({ rider_id, joined_at: now })

Broadcast:

rider_joined

------------------------------------------------------------------------

# 12. Driver Select Rider

Event:

select_rider

Example:

``` json
{
  "type": "select_rider",
  "driver_id": "d1",
  "rider_id": "r2"
}
```

Logic: 1. Check rider exists in riders_waiting 2. If not → reject
request 3. Remove rider from queue 4. Add to pending_matches

pending_matches.set(rider_id, driver_id)

Broadcast:

rider_reserved

Send rider:

match_request

------------------------------------------------------------------------

# 13. Rider Accept Match

Event:

accept_match

Example:

``` json
{
  "type": "accept_match",
  "rider_id": "r2",
  "driver_id": "d1"
}
```

Logic: 1. Decrement driver seat

drivers\[driver_id\].seats_remaining -= 1

2.  Remove pending match

pending_matches.delete(rider_id)

3.  Broadcast:

-   rider_removed
-   seat_update

4.  Insert ride into database.

------------------------------------------------------------------------

# 14. Database Insert

Insert occurs ONLY when rider accepts.

Example SQL:

``` sql
INSERT INTO rides (
    driver_id,
    rider_id,
    ride_date,
    start_time,
    location,
    status
)
VALUES (...)
```

Status should be:

accepted

------------------------------------------------------------------------

# 15. Match Timeout

If rider does not respond within 30 seconds:

1.  Remove from pending_matches
2.  Reinsert rider into riders_waiting
3.  Broadcast rider_joined

Example timer:

setTimeout(expireMatch, 30000)

------------------------------------------------------------------------

# 16. Rider Queue Algorithm

The queue is FIFO.

Suggested riders:

riders_waiting.slice(0, seats_remaining)

This ensures: - fairness - minimal driver wait time

------------------------------------------------------------------------

# 17. Frontend State Handling

Frontend stores rider list locally.

Example React state:

``` js
const [riders, setRiders] = useState([])
```

Handle WebSocket messages:

``` js
switch (msg.type) {

  case "initial_state":
    setRiders(msg.riders)
    break

  case "rider_joined":
    setRiders(prev => [...prev, msg.rider])
    break

  case "rider_removed":
    setRiders(prev => prev.filter(r => r.id !== msg.rider_id))
    break

}
```

The frontend state is a mirror of Durable Object state.

------------------------------------------------------------------------

# 18. Rides Table Schema

Current schema:

id driver_id rider_id day start_time location status completed
created_at

Important notes: - driver_id and rider_id must reference users -
created_at defaults to now() - status values: accepted, completed,
cancelled

------------------------------------------------------------------------

# 19. Indexes

Add indexes:

``` sql
CREATE INDEX rides_driver_idx ON rides(driver_id);
CREATE INDEX rides_rider_idx ON rides(rider_id);
```

------------------------------------------------------------------------

# 20. End-to-End Flow

Driver goes online ↓ Worker resolves slot ↓ Durable Object room ↓ Driver
registered ↓ Rider requests ride ↓ Added to queue ↓ Driver selects rider
↓ Pending match ↓ Rider accepts ↓ Ride inserted into DB
