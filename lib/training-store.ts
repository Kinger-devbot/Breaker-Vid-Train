import { lessons, coverage } from "./lessons";

type Range = [number, number];
type Viewer = {name: string; updated: number; plays: Record<string, Range[]>};

const viewers = "wheelhouse:training:v1:viewers";

export function storageConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redis<T>(...command: (string | number)[]): Promise<T> {
  const url = new URL(process.env.UPSTASH_REDIS_REST_URL!);
  if (url.protocol !== "https:") throw new Error("Redis must use HTTPS.");
  const response = await fetch(url, {
    method: "POST",
    headers: {Authorization: "Bearer " + process.env.UPSTASH_REDIS_REST_TOKEN, "Content-Type": "application/json"},
    body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Progress storage is unavailable.");
  const data = await response.json() as {result: T; error?: string};
  if (data.error) throw new Error("Progress storage rejected the request.");
  return data.result;
}

export async function registerViewer(id: string, name: string) {
  await redis("HSETNX", viewers, id, JSON.stringify({name, updated: Date.now(), plays: {}}));
}

const recordPlayback = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return nil end
local viewer = cjson.decode(raw)
local lesson = ARGV[2]
local ranges = viewer.plays[lesson] or {}
for _, range in ipairs(cjson.decode(ARGV[3])) do
  ranges[#ranges + 1] = range
end
table.sort(ranges, function(a, b) return a[1] < b[1] end)
local merged = {}
for _, range in ipairs(ranges) do
  local last = merged[#merged]
  if last and range[1] <= last[2] then
    last[2] = math.max(last[2], range[2])
  else
    merged[#merged + 1] = range
  end
end
viewer.plays[lesson] = merged
viewer.updated = math.max(viewer.updated, tonumber(ARGV[4]))
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(viewer))
return cjson.encode(merged)
`;

export async function savePlayback(id: string, lesson: string, ranges: Range[]) {
  const result = await redis<string | null>("EVAL", recordPlayback, 1, viewers, id, lesson, JSON.stringify(ranges), Date.now());
  return result === null ? null : JSON.parse(result) as Range[];
}

export async function listProgress() {
  const entries = await redis<string[]>("HGETALL", viewers);
  const rows = [];
  for (let index = 0; index < entries.length; index += 2) {
    const viewer = JSON.parse(entries[index + 1]) as Viewer;
    rows.push({
      id: entries[index], name: viewer.name, updated: viewer.updated,
      progress: lessons.map(lesson => coverage(viewer.plays[lesson.id] ?? [], lesson.seconds)),
    });
  }
  return rows.sort((left, right) => right.updated - left.updated);
}

export async function removeViewer(id: string) {
  await redis("HDEL", viewers, id);
}
