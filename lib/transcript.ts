export type Segment = { id: string; startMs: number; endMs: number; text: string };
export type Transcript = { durationMs: number; segments: Segment[] };
export function clock(ms: number) { const seconds = Math.floor(Math.max(0, ms) / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
export function srtTime(ms: number) { const n = Math.max(0, Math.round(ms)); return `${String(Math.floor(n / 3600000)).padStart(2,"0")}:${String(Math.floor(n / 60000) % 60).padStart(2,"0")}:${String(Math.floor(n / 1000) % 60).padStart(2,"0")},${String(n % 1000).padStart(3,"0")}`; }
export function exportText(segments: Segment[], format: "txt" | "srt") { const lines = segments.filter(s => s.text.trim()); return format === "txt" ? lines.map(s => s.text.trim()).join("\n") : lines.map((s, i) => `${i + 1}\n${srtTime(s.startMs)} --> ${srtTime(s.endMs)}\n${s.text.trim()}`).join("\n\n") + (lines.length ? "\n" : ""); }
export const sample: Transcript = { durationMs: 8592, segments: [
  {id:"sample-1",startMs:0,endMs:2000,text:"Some ideas arrive quietly."},
  {id:"sample-2",startMs:2000,endMs:4700,text:"They need a little room to become something real."},
  {id:"sample-3",startMs:4700,endMs:8592,text:"So take a moment, listen closely, and make a note."}
] };
