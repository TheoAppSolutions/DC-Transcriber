import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import type { Segment } from "./transcript";

let transcriber: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

self.onmessage = async (event: MessageEvent<{ audio: Float32Array; duration: number }>) => {
  try {
    if (!transcriber) {
      transcriber = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
        dtype: "q8",
        progress_callback: (progress) => {
          if (progress.status === "progress") self.postMessage({ status: "loading", file: progress.file, percent: Math.round(progress.progress) });
        },
      });
    }
    let model: AutomaticSpeechRecognitionPipeline;
    try { model = await transcriber; } catch (error) { transcriber = null; throw error; }
    self.postMessage({ status: "transcribing" });
    const output = await model(event.data.audio, { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
    const result = (Array.isArray(output) ? output[0] : output) as { chunks?: { timestamp: [number | null, number | null]; text: string }[] };
    const durationMs = Math.round(event.data.duration * 1000);
    const segments: Segment[] = (result.chunks ?? []).flatMap((chunk, index) => {
      const start = chunk.timestamp?.[0];
      const end = chunk.timestamp?.[1];
      if (typeof start !== "number" || !Number.isFinite(start) || !chunk.text.trim()) return [];
      const startMs = Math.max(0, Math.round(start * 1000));
      const endMs = Math.min(durationMs, typeof end === "number" && Number.isFinite(end) ? Math.round(end * 1000) : durationMs);
      return endMs > startMs ? [{ id: `segment-${index}`, startMs, endMs, text: chunk.text.trim() }] : [];
    }).sort((a, b) => a.startMs - b.startMs);
    self.postMessage({ status: "complete", segments });
  } catch {
    self.postMessage({ status: "error", message: "Transcription could not be completed. Check your connection and device memory, then try again." });
  }
};
