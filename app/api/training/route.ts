import { env } from "cloudflare:workers";
import { lessons, coverage } from "@/lib/lessons";
import { hasManagerSession } from "@/lib/manager-session";

export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {"Cache-Control": "no-store"}});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return json({error: "Invalid request origin."}, 403);
  if (!env.DB) return json({error: "Progress storage is unavailable."}, 503);
  const payload = await req.text();
  if (payload.length > 12000) return json({error: "Request too large."}, 413);
  let body;
  try { body = JSON.parse(payload); } catch { return json({error: "Invalid request."}, 400); }
  if (!body || typeof body.id !== "string" || !uuid.test(body.id)) return json({error: "Invalid viewer."}, 400);
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 80) return json({error: "Enter your name."}, 400);
    await env.DB.prepare("INSERT OR IGNORE INTO viewers (id, name, updated) VALUES (?, ?, ?)").bind(body.id, name, Date.now()).run();
    return json({saved: true});
  }
  const lesson = lessons.find((item) => item.id === body.lesson);
  if (!lesson || !Array.isArray(body.ranges) || body.ranges.length > 30) return json({error: "Invalid playback data."}, 400);
  if (!body.ranges.every((r: unknown) => Array.isArray(r) && r.length === 2 &&
    r.every(n => typeof n === "number" && Number.isFinite(n)) && r[0] >= 0 && r[1] > r[0] && r[1] <= lesson.seconds + 2))
    return json({error: "Invalid playback range."}, 400);
  await env.DB.batch([
    env.DB.prepare("UPDATE viewers SET updated = ? WHERE id = ?").bind(Date.now(), body.id),
    ...body.ranges.map(([from, to]: [number, number]) =>
      env.DB!.prepare("INSERT INTO plays (viewer, lesson, start, stop) VALUES (?, ?, ?, ?) ON CONFLICT(viewer, lesson, start) DO UPDATE SET stop = max(stop, excluded.stop)").bind(body.id, lesson.id, from, to)),
  ]);
  const played = await env.DB.prepare("SELECT start, stop FROM plays WHERE viewer = ? AND lesson = ?")
    .bind(body.id, lesson.id).all<{start: number; stop: number}>();
  return json({saved: true, percent: coverage(played.results.map(range => [range.start, range.stop]), lesson.seconds)});
}

export async function GET(req: Request) {
  if (!hasManagerSession(req, env.TRAINING_ADMIN)) return json({error: "Sign in to view staff progress."}, 401);
  if (!env.DB) return json({error: "Progress storage is unavailable."}, 503);
  const records = await env.DB.prepare(
    "SELECT v.id, v.name, v.updated, p.lesson, p.start, p.stop FROM viewers v LEFT JOIN plays p ON p.viewer = v.id ORDER BY v.updated DESC"
  ).all<{id: string; name: string; updated: number; lesson: string | null; start: number; stop: number}>();
  const rows = new Map<string, {name: string; updated: number; ranges: Map<string, [number, number][]>}>();
  for (const record of records.results) {
    let row = rows.get(record.id);
    if (!row) {
      row = {name: record.name, updated: record.updated, ranges: new Map()};
      rows.set(record.id, row);
    }
    if (record.lesson) {
      const ranges = row.ranges.get(record.lesson) || [];
      ranges.push([record.start, record.stop]);
      row.ranges.set(record.lesson, ranges);
    }
  }
  return json([...rows].map(([id, row]) => ({
    id, name: row.name, updated: row.updated,
    progress: lessons.map(lesson => coverage(row.ranges.get(lesson.id) || [], lesson.seconds)),
  })));
}

export async function DELETE(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return json({error: "Invalid request origin."}, 403);
  if (!hasManagerSession(req, env.TRAINING_ADMIN)) return json({error: "Sign in to remove staff progress."}, 401);
  if (!env.DB) return json({error: "Progress storage is unavailable."}, 503);
  const body = await req.json().catch(() => null) as {id?: unknown} | null;
  if (typeof body?.id !== "string" || !uuid.test(body.id)) return json({error: "Invalid viewer."}, 400);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM plays WHERE viewer = ?").bind(body.id),
    env.DB.prepare("DELETE FROM viewers WHERE id = ?").bind(body.id),
  ]);
  return json({deleted: true});
}
