"use client";

import { useEffect, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { lessons } from "@/lib/lessons";

type Viewer = {id: string; name: string};
type Lesson = (typeof lessons)[number];

export default function Training() {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastSent = useRef(new Map<string, string>());
  const lastTime = useRef(new Map<string, number>());
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const playbackPositions = useRef(new Map<string, number>());
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wheelhouse-viewer") || "null");
      if (saved?.id && saved?.name) {
        setViewer(saved);
        setProgress(JSON.parse(localStorage.getItem("wheelhouse-progress-" + saved.id) || "{}"));
      }
    } catch {}
    setReady(true);
  }, []);

  async function send(body: object) {
    const response = await fetch("/api/training", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body), keepalive: true,
    });
    const result = await response.json().catch(() => null) as {error?: string; percent?: number} | null;
    if (!response.ok || !result) throw new Error(result?.error || "Couldn’t save. Try again.");
    return result;
  }

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setNotice("");
    setSaving(true);
    const next = {id: crypto.randomUUID(), name: name.trim()};
    try {
      await send(next);
      setViewer(next);
      try { localStorage.setItem("wheelhouse-viewer", JSON.stringify(next)); } catch {}
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Couldn’t start training. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function record(event: SyntheticEvent<HTMLVideoElement>, lesson: Lesson, force = false) {
    if (!viewer || event.currentTarget.seeking) return;
    const video = event.currentTarget;
    const now = Date.now();
    if (!force && now - (lastTime.current.get(lesson.id) || 0) < 5000) return;
    const ranges: [number, number][] = [];
    for (let i = 0; i < video.played.length; i++) {
      const from = Number(video.played.start(i).toFixed(2));
      const to = Number(video.played.end(i).toFixed(2));
      if (to > from) ranges.push([from, to]);
    }
    const signature = JSON.stringify(ranges);
    if (!ranges.length || lastSent.current.get(lesson.id) === signature) return;
    lastTime.current.set(lesson.id, now);
    lastSent.current.set(lesson.id, signature);
    const writes = [];
    for (let i = 0; i < ranges.length; i += 30) {
      writes.push(send({id: viewer.id, lesson: lesson.id, ranges: ranges.slice(i, i + 30)}));
    }
    void Promise.all(writes).then(results => {
      const percent = Math.max(...results.map(result => Number(result.percent) || 0));
      setProgress(previous => {
        const next = {...previous, [lesson.id]: Math.max(previous[lesson.id] || 0, percent)};
        try { localStorage.setItem("wheelhouse-progress-" + viewer.id, JSON.stringify(next)); } catch {}
        return next;
      });
      setNotice("");
    }).catch(() => {
      if (lastSent.current.get(lesson.id) === signature) lastSent.current.delete(lesson.id);
      setNotice("Progress couldn’t save. Check your connection and resume playback to retry.");
    });
  }

  return <main>
    <header className="brand"><span className="mark">WH</span><span>Wheelhouse Cards <small>Staff training</small></span><a className="management-link" href="/dashboard">Management</a></header>
    <section className="intro"><p className="eyebrow">LIVEPRO TRAINING</p><h1>Get ready to go live.</h1><p>Watch the LivePro Studio, Fanatics Live and Whatnot lessons.</p></section>
    {!viewer && <form className="panel entry" onSubmit={start}>
      <label htmlFor="name">Your full name</label>
      <input id="name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="First and last name" maxLength={80} required />
      <p className="muted">Wheelhouse can see your name and watch progress.</p>
      <button className="primary" disabled={!ready || saving}>{saving ? "Starting…" : "Start training"}</button>
    </form>}
    {viewer && <section className="panel player">
      <div className="viewer"><span>Watching as <strong>{viewer.name}</strong></span><button className="plain" onClick={() => {
        for (const video of videos.current.values()) video.pause();
        localStorage.removeItem("wheelhouse-viewer");
        setViewer(null);
        setName("");
        setProgress({});
        lastSent.current.clear();
        lastTime.current.clear();
        playbackPositions.current.clear();
      }}>Switch viewer</button></div>
      {lessons.map((lesson, index) => <div key={lesson.id} hidden={active !== index}>
        <h2>{lesson.platform} <span className="muted">/ {lesson.title}</span></h2>
        <div className="playback-controls"><button className="primary play" onClick={() => {
          const video = videos.current.get(lesson.id);
          if (!video) return;
          if (video.paused) void video.play().catch(() => setNotice("Couldn’t start this lesson. Try Play again."));
          else video.pause();
        }}>{playing === lesson.id ? "Pause lesson" : "Play lesson"}</button>
        <button className="plain" onClick={() => setMuted(value => !value)}>{muted ? "Unmute" : "Mute"}</button></div>
        <video ref={node => { if (node) videos.current.set(lesson.id, node); else videos.current.delete(lesson.id); }}
          src={"https://learn.live.pro/" + lesson.path} playsInline disablePictureInPicture disableRemotePlayback muted={muted} preload="none"
          onPlay={() => setPlaying(lesson.id)} onTimeUpdate={event => {
            const video = event.currentTarget;
            if (video.seeking) return;
            playbackPositions.current.set(lesson.id, video.currentTime);
            record(event, lesson);
          }}
          onSeeking={event => {
            const video = event.currentTarget;
            const position = playbackPositions.current.get(lesson.id) ?? 0;
            if (Math.abs(video.currentTime - position) > 0.01) video.currentTime = position;
          }}
          onPause={e => {setPlaying(current => current === lesson.id ? null : current); record(e, lesson, true);}}
          onEnded={e => {setPlaying(null); record(e, lesson, true);}}
          onError={() => setNotice("The LivePro player couldn’t load this lesson. Try reloading the page.")} />
      </div>)}
    </section>}
    {notice && <p role="status" className="notice">{notice}</p>}
    <section className="lesson-list" aria-label="Lessons">
      {lessons.map((lesson, index) => <button key={lesson.id} className={"lesson " + (active === index && viewer ? "selected" : "")}
        disabled={!viewer} aria-pressed={!!viewer && active === index} onClick={() => {
          videos.current.get(lessons[active].id)?.pause();
          setActive(index);
        }}>
        <span className="lesson-index">0{index + 1}</span><span><strong>{lesson.platform}</strong><small>{lesson.title}</small></span>
        <span className="lesson-status">{progress[lesson.id] === 100 ? "Complete" : progress[lesson.id] ? progress[lesson.id] + "%" : Math.floor(lesson.seconds / 60) + " min"}</span>
      </button>)}
    </section>
  </main>;
}
