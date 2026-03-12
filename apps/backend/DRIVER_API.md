## Driver API – Frontend Contract

This document describes what the frontend must send to the backend `driver` API.

**Frontend requirement:** even though the backend treats many fields as optional, the **frontend should treat all fields as required in the UI and always send values for every field in the form data** (no optional/omitted fields from the frontend side).

### Endpoint

- **Method**: `POST`
- **Path**: `/api/driver`
- **Content-Type**: `multipart/form-data`

> Authentication (e.g. Supabase auth) is handled separately. This route only validates the `userID` it receives.

### Required field

- **userID** (`string`, required)
  - The authenticated user's id.
  - Must be non-empty after trimming, otherwise the API returns **400**.

### User profile fields

From the **frontend** perspective, these fields are **required** and should always be sent.  
On the backend, if present, values are trimmed; empty strings effectively become `null`.

- **name** (`string`, required on frontend) – Driver's display name.
- **residence** (`string`, required on frontend) – Where the driver lives (city/area).
- **picture** (`File`, required on frontend) – Image file for the driver's avatar.
  - Accepted extensions: `jpg`, `jpeg`, `png`, `gif`, `webp` (anything else is stored as `jpg`).
  - Stored in Supabase Storage bucket `driver-pictures` at path: `${userID}/avatar.<ext>`.
  - The resulting public URL is returned as `picture_url` in the response and saved to the `User.picture_url` column.

### Driver flag

- **is_driver** (`string`, required on frontend)
  - Treated as **true** only if the value is `"true"` or `"1"`.
  - Any other value (including missing) is treated as **false**.
  - Saved to `User.is_driver` and also used on the schedule row (if schedule is sent).

### Car fields

From the **frontend** perspective, these fields are **required** and should always be sent.  
If **any** of these are provided (non-`null` after reading the form), the backend will **upsert a row into the `Car` table**, keyed by `user_id`:

- **make** (`string`, required on frontend) – Car manufacturer.
- **model** (`string`, required on frontend) – Car model.
- **color** (`string`, required on frontend) – Car color.
- **license_plate** (`string`, required on frontend) – License plate.
- **capacity** (`string` representing an integer, required on frontend) – Number of seats.
  - Parsed with `parseInt(value, 10)`.
  - If parsing fails, `capacity` becomes `null`.

> Note: The backend uses **upsert on `user_id`** for the `Car` table. With a unique constraint on `user_id`, sending car info multiple times will update the existing `Car` row for that user instead of creating duplicates.

### Schedule fields

For **multiple days and times**, the only schedule input used by this driver endpoint is the `days` JSON.

If `days` is provided and parses successfully, the backend will **upsert a row into the `schedule` table**, keyed by `user_id`, with:

- `user_id` – the `userID` sent in the request.
- `is_driver` – computed from `is_driver` field.
- `days` – the parsed JSON object.

`days` is parsed as JSON into a structure like:

```json
{
  "mon": { "start_time": "08:00", "end_time": "09:00" },
  "tue": { "start_time": "18:00", "end_time": "19:00" },
  "wed": { "start_time": "08:00", "end_time": "09:00" },
  "thu": { "start_time": "08:00", "end_time": "09:00" },
  "fri": { "start_time": "08:00", "end_time": "09:00" }
}
```

- Allowed day keys: `"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"`.
- Each value is an object: `{ start_time: string; end_time: string }`.
- If JSON parsing fails, `days` becomes `null` on the schedule row, but a schedule row is still inserted as long as **any** schedule field was sent.

### Example (TypeScript / frontend)

```ts
const formData = new FormData();

// Required
formData.append("userID", user.id);

// User profile (all required on frontend)
formData.append("name", "Jane Driver");
formData.append("residence", "Downtown");
formData.append("is_driver", "true"); // or "1"

// File input from <input type="file" />
if (fileInput.files?.[0]) {
  formData.append("picture", fileInput.files[0]);
}

// Car info (all required on frontend)
formData.append("make", "Toyota");
formData.append("model", "Corolla");
formData.append("color", "Blue");
formData.append("license_plate", "ABC-123");
formData.append("capacity", "4"); // must be a string

// Schedule (driver availability encoded in `days` only)
formData.append(
  "days",
  JSON.stringify({
    mon: { start_time: "08:00", end_time: "09:00" },
    tue: { start_time: "18:00", end_time: "19:00" },
  }),
);

await fetch("/api/driver", {
  method: "POST",
  body: formData,
});
```

### Successful response

On success (**200**):

```json
{
  "success": true,
  "user_id": "the-user-id",
  "picture_url": "https://public-url-to-avatar-or-null"
}
```

- `picture_url` is `null` if no picture was uploaded.

### Error responses

- **400 – Missing/invalid userID**

```json
{ "error": "userID is required" }
```

- **500 – Internal/server/Supabase error**

```json
{
  "error": "Failed to save user | Failed to save car | Failed to save schedule | Failed to upload image | Internal server error",
  "details": "More specific error message when available"
}
```

