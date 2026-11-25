"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowRight, AudioLines, Check, FileAudio, Headphones, LoaderCircle, Mic2, Pencil, Play, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import { clock, exportText, sample, type Segment } from "@/lib/transcript";

const MAX_DURATION = 30 * 60;
const PART_DURATION = 5 * 60;

type Recording = { name: string; url: string; size: number; duration: number; file?: File; sample: boolean };
export default function Home() {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const selectionId = useRef(0);
  const workers = useRef<Worker[]>([]);
  const abortJob = useRef<AbortController | null>(null);
  const jobId = useRef(0);
  const [status, setStatus] = useState("");
  const cancel = () => { jobId.current++; abortJob.current?.abort(); abortJob.current = null; workers.current.forEach(w => w.terminate()); workers.current = []; setBusy(false); setStatus(""); };
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); abortJob.current?.abort(); workers.current.forEach(w => w.terminate()); }, []);
  const replace = (next: Recording, nextSegments: Segment[]) => { cancel(); if (objectUrl.current && objectUrl.current !== next.url) URL.revokeObjectURL(objectUrl.current); objectUrl.current = next.sample ? null : next.url; setRecording(next); setSegments(nextSegments); setEditingId(null); setCurrent(0); setError(""); };
  const openSample = () => { selectionId.current++; replace({ name: "A little room for ideas.mp3", url: "/sample.mp3", size: 0, duration: sample.durationMs / 1000, sample: true }, sample.segments.map(s => ({ ...s }))); };
  const choose = (file?: File) => {
    if (!file) return;
    const id = ++selectionId.current;
    setError("");
    if (!/\.(mp3|wav|m4a)$/i.test(file.name)) { setError("Choose an MP3, WAV, or M4A audio file."); return; }
    if (!file.size) { setError("Choose a nonempty audio file."); return; }
    const url = URL.createObjectURL(file), probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => { if (id !== selectionId.current) { URL.revokeObjectURL(url); return; } if (!Number.isFinite(probe.duration) || probe.duration <= 0) { URL.revokeObjectURL(url); setError("Choose a readable audio recording."); return; } replace({ name: file.name, url, size: file.size, duration: probe.duration, file, sample: false }, []); };
    probe.onerror = () => { URL.revokeObjectURL(url); if (id === selectionId.current) setError("This audio file could not be opened. Try a different file."); };
    probe.src = url;
  };
  const transcribe = async () => {
    if (!recording?.file || busy) return;
    if (segments.length && !window.confirm("Replace the current transcript and its edits?")) return;
    const id = ++jobId.current;
    const controller = new AbortController();
    abortJob.current = controller;
    setBusy(true); setError(""); setStatus("Preparing audio…");
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await recording.file.arrayBuffer());
      const duration = Math.min(decoded.duration, MAX_DURATION);
      const partCount = Math.ceil(duration / PART_DURATION);
      const activeWorker = new Worker(new URL("../lib/transcriber.worker.ts", import.meta.url));
      workers.current.push(activeWorker);
      const results: Segment[] = [];
      for (let index = 0; index < partCount; index++) {
        if (controller.signal.aborted) return;
        const offset = index * PART_DURATION;
        const length = Math.min(PART_DURATION, duration - offset);
        setStatus(`Preparing part ${index + 1} of ${partCount}…`);
        const offline = new OfflineAudioContext(1, Math.ceil(length * 16000), 16000);
        const source = offline.createBufferSource();
        source.buffer = decoded; source.connect(offline.destination); source.start(0, offset, length);
        const rendered = await offline.startRendering();
        if (id !== jobId.current) return;
        const samples = rendered.getChannelData(0);
        const partSegments = await new Promise<Segment[]>((resolve, reject) => {
          const onAbort = () => reject(new Error("Cancelled"));
          controller.signal.addEventListener("abort", onAbort, { once: true });
          const finish = () => controller.signal.removeEventListener("abort", onAbort);
          activeWorker.onmessage = (event) => {
            if (id !== jobId.current) return;
            const data = event.data;
            if (data.status === "loading") setStatus(`Downloading model: ${data.file} (${data.percent}%)`);
            if (data.status === "transcribing") setStatus(`Transcribing part ${index + 1} of ${partCount} on your device…`);
            if (data.status === "complete") { finish(); resolve(data.segments as Segment[]); }
            if (data.status === "error") { finish(); reject(new Error(data.message)); }
          };
          activeWorker.onerror = () => { finish(); reject(new Error("Transcription stopped unexpectedly. Try a shorter recording or another browser.")); };
          activeWorker.postMessage({ audio: samples, duration: length }, [samples.buffer]);
        });
        results.push(...partSegments.map(segment => ({ ...segment, id: `part-${index}-${segment.id}`, startMs: segment.startMs + Math.round(offset * 1000), endMs: segment.endMs + Math.round(offset * 1000) })));
      }
      activeWorker.terminate();
      workers.current = workers.current.filter(w => w !== activeWorker);
      if (id !== jobId.current) return;
      setBusy(false); setStatus("");
      const combined = results.sort((a, b) => a.startMs - b.startMs);
      if (combined.length) { setSegments(combined); setEditingId(null); } else setError("No speech was detected. Try a clearer recording.");
    } catch (cause) { if (id === jobId.current) { workers.current.forEach(w => w.terminate()); workers.current = []; setBusy(false); setStatus(""); setError(cause instanceof Error && cause.message.startsWith("Transcription") ? cause.message : "Could not prepare this audio. Try a different or shorter recording."); } }
    finally { if (abortJob.current === controller) abortJob.current = null; if (context) void context.close(); }
  };
  const download = (format: "txt" | "srt") => { const contents = exportText(segments, format); if (!contents) return; const url = URL.createObjectURL(new Blob([contents], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `transcript.${format}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const seek = (ms: number) => { if (!audio.current) return; audio.current.currentTime = ms / 1000; setCurrent(ms); void audio.current.play().catch(() => {}); };
  const hasText = segments.some(s => s.text.trim());
  return <main className="site"><header className="topbar"><Link href="/" className="brand"><span className="brand-mark"><AudioLines size={21}/></span>dc-transcriber<span className="brand-period">.</span></Link><div className="top-right"><span className="top-dot"/> YOUR LISTENING WORKSPACE</div></header>
    <div className="page"><div className="intro"><div><div className="eyebrow"><Sparkles size={14}/> A LITTLE MORE CLARITY</div><h1>Good things are<br/><em>worth noting.</em></h1><p>Turn the moments you hear into words you can keep. Listen, tidy things up, and take your transcript with you.</p></div><div className="intro-art" aria-hidden="true"><div className="art-circle"><AudioLines size={62} strokeWidth={1.1}/></div><span className="art-star">✳</span><span className="art-caption">MADE FOR<br/>LISTENING CLOSELY</span></div></div>
    <div className="workspace"><aside className="sidebar"><div className="sidebar-head"><span className="small-label">YOUR RECORDING</span><span className="step">01</span></div><h3>Start with a sound.</h3><p className="muted">Bring your own recording or take our sample for a spin.</p>
      <button className="sample-card" onClick={openSample}><span className="sample-icon"><Headphones size={20}/></span><span className="sample-copy"><strong>Try the sample</strong><small>A little room for ideas · 0:08</small></span><ArrowRight size={18}/></button>
      <div className="or"><span/> OR UPLOAD YOUR OWN <span/></div>
      <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);choose(e.dataTransfer.files[0]);}}><span className="upload-icon"><Upload size={20}/></span><strong>Drop your audio here</strong><span>or <button className="text-button" onClick={()=>input.current?.click()}>browse files</button></span><small>MP3, WAV, M4A · Processing depends on your device</small><input ref={input} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" hidden onChange={e=>{choose(e.target.files?.[0]);e.target.value="";}}/></div>
      <p className="privacy">Only the first 30 minutes of your audio file will be transcribed. Audio is processed on your device in parts of up to 5 minutes, and playback is limited to the first 30 minutes. The first use downloads a speech model; large recordings can exceed device memory.</p>
      {recording && <div className="file-info"><FileAudio size={19}/><div><strong>{recording.name}</strong><small>{clock(recording.duration * 1000)} {recording.size ? `· ${(recording.size / 1048576).toFixed(2)} MB` : "· SAMPLE RECORDING"}</small></div><Check size={16}/></div>}
      {recording && recording.duration > MAX_DURATION && <p className="privacy" role="status">Only the first 30 minutes will be transcribed and played.</p>}
      {recording?.file && <button className="primary full" onClick={transcribe} disabled={busy}>{busy?<><LoaderCircle className="spin" size={17}/> Working…</>:<><Sparkles size={16}/> Transcribe audio</>}</button>}
      
      {error && <div className="error" role="alert">{error} <button onClick={()=>setError("")} aria-label="Dismiss error"><X size={15}/></button></div>}
    </aside><section className="editor"><div className="editor-head"><div><span className="small-label">THE TRANSCRIPT</span><h3>{recording ? "Listen & make it yours." : "Your words live here."}</h3></div><span className="step">02</span></div>
      {recording ? <><div className="player"><div className="player-icon"><AudioLines size={23}/></div><div className="player-content"><div className="player-title"><strong>{recording.name}</strong><span>{clock(current)} / {clock(Math.min(recording.duration, MAX_DURATION) * 1000)}</span></div><audio key={recording.url} ref={audio} controls preload="metadata" src={recording.url} onTimeUpdate={e=>{const player=e.currentTarget;if(player.currentTime >= MAX_DURATION){player.pause();player.currentTime=MAX_DURATION;}setCurrent(Math.min(player.currentTime, MAX_DURATION) * 1000)}} onSeeking={e=>{if(e.currentTarget.currentTime > MAX_DURATION)e.currentTarget.currentTime=MAX_DURATION}} aria-label="Recording playback"/></div></div>
      {busy && <div className="processing" role="status" aria-live="polite"><div className="processing-icon"><LoaderCircle className="spin" size={24}/></div><div className="processing-copy"><span className="processing-label">TRANSCRIPTION IN PROGRESS</span><h4>We’re working on your transcript.</h4><p>{status || "Preparing your recording…"}</p><small>This may take a while. Keep this page open while your audio is processed.</small></div><div className="processing-pulse" aria-hidden="true"><span/><span/><span/></div></div>}
      {segments.length ? <><div className="transcript-top"><div><strong>Transcript</strong><span>{segments.length} {segments.length === 1 ? "segment" : "segments"}</span></div><span>PLAY A SEGMENT TO LISTEN</span></div><div className="segments">{segments.map((s,i)=><div className={`segment ${current >= s.startMs && current < s.endMs ? "active" : ""}`} key={s.id}><button className="timestamp" onClick={()=>seek(s.startMs)} aria-label={`Play segment ${i+1} at ${clock(s.startMs)}`}><Play size={13} fill="currentColor" aria-hidden="true"/>{clock(s.startMs)}</button>{editingId === s.id ? <textarea autoFocus aria-label={`Edit transcript segment ${i+1}`} rows={2} value={s.text} onChange={e=>setSegments(old=>old.map(x=>x.id===s.id?{...x,text:e.target.value}:x))}/> : <p className="segment-text">{s.text}</p>}<button className="edit-segment" onClick={()=>setEditingId(editingId === s.id ? null : s.id)} aria-label={`${editingId === s.id ? "Finish editing" : "Edit"} transcript segment ${i+1}`} title={editingId === s.id ? "Done editing" : "Edit segment"}>{editingId === s.id ? <Check size={16}/> : <Pencil size={16}/>}</button></div>)}</div><div className="editor-footer"><div><span className="small-label">READY WHEN YOU ARE</span><p>Edits are temporary. Refreshing clears your draft.</p></div><div className="export-actions"><button className="secondary" disabled={!hasText} onClick={()=>download("txt")}><ArrowDownToLine size={15}/> TXT</button><button className="primary" disabled={!hasText} onClick={()=>download("srt")}><ArrowDownToLine size={15}/> Export SRT</button></div></div></> : !busy && <div className="empty compact"><div className="empty-icon"><Mic2 size={27}/></div><h4>Ready for the words?</h4><p>Transcribe your recording to start editing, or try the sample.</p><button className="text-button" onClick={openSample}>Open the sample <ArrowRight size={14}/></button></div>}</> : <div className="empty"><div className="empty-illustration"><span className="empty-ring"><AudioLines size={46} strokeWidth={1.1}/></span><i>✳</i></div><h4>A little space for your big ideas.</h4><p>Choose a recording to see your transcript here. You can edit every line and jump back to the moment it was said.</p><button className="text-button" onClick={openSample}>Start with the sample <ArrowRight size={15}/></button></div>}
    </section></div><div className="bottom-note"><span>✳</span> MADE FOR THE MOMENTS YOU DON’T WANT TO MISS <span>TAKE YOUR TIME. WE’RE LISTENING.</span></div></div><footer><span>dc-transcriber<span className="brand-period">.</span></span><p>A quieter way to keep the good stuff.</p><button onClick={()=>{if(recording && !window.confirm("Clear this recording and transcript?"))return; selectionId.current++; cancel(); if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);objectUrl.current=null;setRecording(null);setSegments([]);setEditingId(null);setCurrent(0);setError("");setCopied(true);setTimeout(()=>setCopied(false),2000);}}><RotateCcw size={14}/> {copied ? "Workspace cleared" : "Clear workspace"}</button></footer></main>;
}
