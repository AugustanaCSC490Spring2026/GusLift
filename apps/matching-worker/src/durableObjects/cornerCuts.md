- Make provision for rider rejectin a ride(driver) button in backend.

  - **Fix:** `reject_match` handled in `MatchingRoom`; rider app sends `reject_match` and rider is re-queued with `rider_joined`.

- rider joining DO first doesnt show on drivers side.

  - **Fix:** `initial_state` includes waiting riders on every connect; `sendInitialState` after `driver_online` replays state for clients that attached listeners late.

-

  - **Fix:** (no standalone item — spacing only.)

- The frontend has a place that displays the schedule time, to and from we are matching them for. check the backends retrieve schedule to see if we have all that info and the API works right.



  - **Fix:** Shared `GET` in `apps/backend/lib/user-schedule.ts` returns `days`, `pickup_loc`, `dropoff_loc`, and optional `?day=` slice for that day’s block.



- supabase.from("schedule").select("user_id, days").eq("user_id", userId).single() we just pick the first schedule for matching. We need to check how schedule checking is being handled. If a user doesnt have a schedule on that day, and is requesting a ride, instead of returning if (e instanceof SlotResolveError) {

  return new Response(JSON.stringify({ error: e.message }), {

  status: 400,

  headers: { "Content-Type": "application/json" },

  });

  }



  lets prompt them to input the time they want a ride, then we match them. no schedule input for this just matching. so we should have a manual onetime inpput feature, like an uber service type thing. and of course completed rides should still go into the rides table.



  - **Fix:** `ManualSlotRequiredError` / `resolveMatchingSlotWithOverride` in worker; mobile `MatchingContext` GET preflight then WebSocket with same `location`/`time`/`day` params; accepted rides still written via `insertRide` in the DO.



- we should also show good information about the driver to user and user to driver. so lets have the right info in our DO that gets shared in the websocket. Roders: their to location,name,picture. Drivers: Name,picture,car details,and their to location too.



  - **Fix:** `rider_joined` / `match_request` (with `driver` object) / `match_confirmed` payloads carry name, picture, `to_location`, car, and rider profile fields from `MatchingRoom`.



- explore driver spinning up DO not time start location

  - **Fix:** Matching room is keyed by resolved slot string (`location:day:time`); driver and rider must use the same query params so they join the same DO (`driver_online` after `connect()` with the same slot as riders).

- DO for each ride share

  - **Fix:** One DO instance per slot key; everyone in that time/location bucket shares that room (not one DO per ride row).

- driver can kickout riders // not worked on yet

  - **Fix:** Not implemented — would need a new client event + DO handler (e.g. remove rider from queue / pending match) when prioritized.




-NEW
- No picture input for driver registration  
- check for how long before we can stach matching people for the day.
- when drivers quit the page, their connection cuts so matching cannot be done until the site is loaded. -- maybe not a big problem

- Tradeoff: A one-off manual “to” from the request flow is not stored anywhere, so Upcoming Rides will only show the saved rider schedule dropoff. To show custom manual destinations later, you’d need either a DB field or updating schedule when they request manually.



Pickup field on the upcoming rides tiles, uses class start time
Fix the user flow for upcoming rides esp for rider. the shouldnt be able to go back and request a ride again(maybe have a checker for double scheduling)

Ride details when you click on the upcoming rides for rider still has hardcoded "To"
the handle select rider tile is not showing the users correct To location. 