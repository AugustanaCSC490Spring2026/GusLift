import { NextRequest, NextResponse } from "next/server";

import {
  createNotification,
  getUnreadNotificationCount,
  listNotifications,
  markNotificationsRead,
} from "@/lib/notifications";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-user-id, X-User-Id",
  );
  return response;
}

function getUserId(request: NextRequest) {
  return (
    request.headers.get("x-user-id")?.trim() ||
    request.nextUrl.searchParams.get("user_id")?.trim() ||
    ""
  );
}

export function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return withCors(
        NextResponse.json({ error: "x-user-id header is required" }, { status: 400 }),
      );
    }

    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 100)
        : 30;
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(userId, limit),
      getUnreadNotificationCount(userId),
    ]);

    return withCors(
      NextResponse.json({
        success: true,
        notifications,
        unread_count: unreadCount,
      }),
    );
  } catch (error) {
    return withCors(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      ),
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return withCors(
        NextResponse.json({ error: "x-user-id header is required" }, { status: 400 }),
      );
    }

    const body = await request.json().catch(() => ({}));
    const type = typeof body.type === "string" ? body.type.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const message = typeof body.body === "string" ? body.body.trim() : "";
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? body.data
        : {};
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : null;
    const shouldSendEmail = body.sendEmail === true;

    if (!type || !title || !message) {
      return withCors(
        NextResponse.json(
          { error: "type, title, and body are required" },
          { status: 400 },
        ),
      );
    }

    const notification = await createNotification({
      userId,
      type,
      title,
      body: message,
      data,
      idempotencyKey,
      sendEmail: shouldSendEmail,
    });

    return withCors(NextResponse.json({ success: true, notification }));
  } catch (error) {
    return withCors(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      ),
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) {
      return withCors(
        NextResponse.json({ error: "x-user-id header is required" }, { status: 400 }),
      );
    }

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids)
      ? body.ids.map((id: unknown) => String(id).trim()).filter(Boolean)
      : undefined;

    await markNotificationsRead(userId, ids);
    return withCors(NextResponse.json({ success: true }));
  } catch (error) {
    return withCors(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      ),
    );
  }
}
