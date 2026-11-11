import { listProgress, registerViewer, removeViewer, savePlayback, storageConfigured } from "@/lib/training-store";
import { lessons, coverage } from "@/lib/lessons";
import { hasManagerSession } from "@/lib/manager-session";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {"Cache-Control": "no-store"}});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return json({error: "Invalid request origin."}, 403);
  if (!storageConfigured()) return json({error: "Progress storage is unavailable."}, 503);
  const payload = await req.text();
  if (payload.length > 12000) return json({error: "Request too large."}, 413);
  let body;
  try { body = JSON.parse(payload); } catch { return json({error: "Invalid request."}, 400); }
  if (!body || typeof body.id !== "string" || !uuid.test(body.id)) return json({error: "Invalid viewer."}, 400);
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 80) return json({error: "Enter your name."}, 400);
    try {
      await registerViewer(body.id, name);
      return json({saved: true});
    } catch { return json({error: "Progress storage is unavailable."}, 503); }
  }
  const lesson = lessons.find((item) => item.id === body.lesson);
  if (!lesson || !Array.isArray(body.ranges) || !body.ranges.length || body.ranges.length > 30) return json({error: "Invalid playback data."}, 400);
  if (!body.ranges.every((r: unknown) => Array.isArray(r) && r.length === 2 &&
    r.every(n => typeof n === "number" && Number.isFinite(n)) && r[0] >= 0 && r[1] > r[0] && r[1] <= lesson.seconds + 2))
    return json({error: "Invalid playback range."}, 400);
  try {
    const played = await savePlayback(body.id, lesson.id, body.ranges);
    if (!played) return json({error: "This viewer was removed. Switch viewer to start again."}, 410);
    return json({saved: true, percent: coverage(played, lesson.seconds)});
  } catch { return json({error: "Progress storage is unavailable."}, 503); }
}

export async function GET(req: Request) {
  if (!hasManagerSession(req, process.env.TRAINING_ADMIN)) return json({error: "Sign in to view staff progress."}, 401);
  if (!storageConfigured()) return json({error: "Progress storage is unavailable."}, 503);
  try { return json(await listProgress()); }
  catch { return json({error: "Progress storage is unavailable."}, 503); }
}

export async function DELETE(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return json({error: "Invalid request origin."}, 403);
  if (!hasManagerSession(req, process.env.TRAINING_ADMIN)) return json({error: "Sign in to remove staff progress."}, 401);
  if (!storageConfigured()) return json({error: "Progress storage is unavailable."}, 503);
  const body = await req.json().catch(() => null) as {id?: unknown} | null;
  if (typeof body?.id !== "string" || !uuid.test(body.id)) return json({error: "Invalid viewer."}, 400);
  try {
    await removeViewer(body.id);
    return json({deleted: true});
  } catch { return json({error: "Progress storage is unavailable."}, 503); }
}
