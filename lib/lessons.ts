export const lessons = [
  { id: "studio", platform: "LivePro Studio", title: "Browser Sources and Interact", seconds: 119, path: "browser-source-interact/v2/browser-source-interact.mp4" },
  { id: "fanatics", platform: "Fanatics Live", title: "From Setup to Go Live", seconds: 644, path: "fanatics-full-setup/v3/fanatics-full-setup.mp4" },
  { id: "whatnot", platform: "Whatnot", title: "From Setup to Go Live", seconds: 760, path: "whatnot-first-setup/v1/whatnot-first-setup.mp4" },
] as const;

export function coverage(ranges: [number, number][], duration: number) {
  let end = 0, watched = 0;
  for (const [from, to] of ranges.toSorted((a, b) => a[0] - b[0])) {
    watched += Math.max(0, Math.min(duration, to) - Math.max(end, from));
    end = Math.max(end, to);
  }
  return watched >= duration - 1 ? 100 : Math.floor(watched / duration * 100);
}
