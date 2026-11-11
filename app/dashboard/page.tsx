"use client";

import { useEffect, useState, type FormEvent } from "react";
import { lessons } from "@/lib/lessons";

type Row = {id: string; name: string; updated: number; progress: number[]};

async function readProgress() {
  const response = await fetch("/api/training", {cache: "no-store"});
  if (response.status === 401) return null;
  const data = await response.json() as Row[] | {error?: string};
  if (!response.ok || !Array.isArray(data)) throw new Error(!Array.isArray(data) && data.error || "Couldn’t load progress.");
  return data;
}

export default function Dashboard() {
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void readProgress().then(setRows).catch(() => setStatus("Couldn’t check your session. Try signing in.")).finally(() => setReady(true));
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/training/session", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({code: code.trim()}),
      });
      const result = await response.json() as {error?: string};
      if (!response.ok) throw new Error(result.error || "Couldn’t sign in.");
      const progress = await readProgress();
      if (!progress) throw new Error("Couldn’t start your session. Check that cookies are enabled.");
      setCode("");
      setRows(progress);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn’t sign in.");
    } finally { setPending(false); }
  }

  async function refresh() {
    setPending(true);
    setStatus("");
    try {
      const progress = await readProgress();
      setRows(progress);
      if (!progress) setStatus("Your session expired. Sign in again.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn’t refresh progress.");
    } finally { setPending(false); }
  }

  async function logout() {
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/training/session", {method: "DELETE"});
      if (!response.ok) throw new Error();
      setRows(null);
    } catch { setStatus("Couldn’t sign out. Try again."); }
    finally { setPending(false); }
  }

  async function removeViewer(row: Row) {
    if (pending || !window.confirm("Delete " + row.name + " and their watch progress?")) return;
    setPending(true);
    setStatus("");
    try {
      const response = await fetch("/api/training", {
        method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id: row.id}),
      });
      if (response.status === 401) {
        setRows(null);
        setStatus("Your session expired. Sign in again.");
        return;
      }
      if (!response.ok) throw new Error();
      setRows(current => current?.filter(item => item.id !== row.id) ?? null);
    } catch { setStatus("Couldn’t delete that entry. Try again."); }
    finally { setPending(false); }
  }

  return <main>
    <header className="brand"><span className="mark">WH</span><span>Wheelhouse Cards <small>Staff training</small></span></header>
    <section className="intro"><p className="eyebrow">MANAGEMENT</p><h1>Watch progress</h1><p>See how much of each LivePro lesson your team has played.</p></section>
    {ready && !rows && <form className="panel entry" onSubmit={login}>
      <label htmlFor="code">Management password</label>
      <input id="code" type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} required />
      <button className="primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>}
    {status && <p role="status">{status}</p>}
    {rows && <>
      <div className="manager-actions">
        <button className="primary" disabled={pending} onClick={refresh}>Refresh progress</button>
        <button className="plain" disabled={pending} onClick={logout}>Sign out</button>
      </div>
      <section className="panel results" aria-label="Staff progress">
        {rows.length ? <table><thead><tr><th>Name</th>{lessons.map(lesson => <th key={lesson.id}>{lesson.platform}</th>)}<th>Last activity</th><th>Remove</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th>{row.progress.map((p, i) =>
            <td className={p === 100 ? "complete" : ""} key={i}>{p === 100 ? "Complete" : p + "%"}</td>)}
            <td>{new Date(row.updated).toLocaleString()}</td><td><button type="button" className="remove-viewer" disabled={pending} aria-label={"Delete " + row.name} onClick={() => void removeViewer(row)}>×</button></td></tr>)}</tbody></table> : <p>No one has started training yet.</p>}
      </section>
    </>}
  </main>;
}
