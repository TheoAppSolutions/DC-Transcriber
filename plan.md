# Project plan (historical)

The original plan below describes the first Deepgram-based MVP. Transcription now runs locally in the browser with Transformers.js; see README for current setup and behavior.

# Audio Transcript Builder — Project Plan

## Project goal

Build a web app that turns a short audio recording into an editable transcript. Give users one workspace to play the original recording, jump to a specific line, correct transcription mistakes, and download the result.

**Portfolio demo** — Open the sample recording, click a timestamp to hear the line, correct a misspelled name, and export subtitles. Visitors can also upload a short clip to try live transcription when it is enabled.

## MVP features

| Feature | Expected behavior |
| --- | --- |
| Upload audio | Choose or drop a single MP3, WAV, or M4A file. Display the filename, duration, and file size before transcription. Start with a 4 MB file limit and a 90 second duration limit. |
| Generate transcript | Send the audio to a server endpoint and return timestamped segments. Show a processing state and allow a manual retry after recoverable failures. |
| Review and edit | Play or pause the recording, click any timestamp to seek to that line, and highlight the current segment during playback. Edit segment text while keeping its timestamps. |
| Export | Download the edited text as UTF-8 plain text (`.txt`) or numbered subtitle cues (`.srt`). |
| Try a sample | Bundle an original short recording and its pre-generated transcript. The sample opens the same editor and works without a transcription key. |

The first release focuses on short English recordings. Later releases can add speaker labels, language selection, longer uploads, and saved projects.

## Stack and architecture

- Use Next.js App Router, TypeScript, and Tailwind CSS. Keep the upload panel and editor in a single workspace at `/`.
- Use the browser's native audio element for playback and a temporary object URL for selected files. Release the URL when a file is replaced or the workspace closes.
- Use a Next.js Node.js route at `POST /api/transcribe` for multipart uploads. The 4 MB application limit leaves room for multipart overhead under the 4.5 MB request limit. [Vercel Functions limits](https://vercel.com/docs/functions/limitations#request-body-size)
- Use Deepgram as the initial provider. Route requests through a server module that normalizes its utterances into the app's transcript format. The API supplies each utterance's text and start and end times. [Deepgram utterances](https://developers.deepgram.com/docs/utterances)
- Keep drafts in browser memory for v1. Explain beside the export controls that refreshing clears the current draft. Keep the audio and transcript out of app databases and logs, and tell visitors before upload that the audio is sent to the provider for transcription.

## Request and data model

`POST /api/transcribe` receives one multipart field named `audio`. It returns a transcript with the following shape on success.

```ts
type Transcript = {
  durationMs: number;
  segments: {
    id: string;
    startMs: number;
    endMs: number;
    text: string;
  }[];
};
```

- Use whole milliseconds throughout the app. Normalize segments in playback order, validate that each segment has a positive duration, and treat an empty segment list as “no speech detected.”
- Keep edited text in the same segment model used for playback and export. Skip blank lines on export. For SRT, number nonempty cues in order and format timecodes as `HH:MM:SS,mmm`. For TXT, join nonempty lines in playback order.
- Reject unsupported, corrupt, or oversized uploads with actionable messages. Check file size and duration in the browser for immediate feedback, then validate file size, container type, and duration again on the server before sending audio to the provider.
- Allow one active submission per workspace. Set an upstream timeout below the deployed function timeout. If the provider is unavailable or a request times out, keep the selected file available for retry.

## Public demo and deployment

- Keep the sample recording and transcript in the repository so the editor, playback, and downloads work without credentials.
- Store the provider key in the server environment variable `DEEPGRAM_API_KEY` and ship a placeholder in `.env.example`. Public transcription has no app-level usage limit; the sample remains available if the key is missing.
- Set up this folder as a standalone GitHub repository and use it as the Vercel project root. Document local setup, environment variables, supported files, upload limits, and audio handling in the README.
- Add a short GIF or screen recording that shows the timestamp seek, a text correction, and export.

## Build milestones

- [ ] Set up the app shell, record the sample clip, and create the sample transcript using the same data model as live results.
- [ ] Build file selection, playback, and client validation. Give the sample its own prominent entry point.
- [ ] Implement server validation, the provider request, response normalization, and error states. Run the live flow with a small known recording in each supported format during implementation.
- [ ] Build timestamp seeking, current line highlighting, text editing, and TXT and SRT downloads.
- [ ] Deploy to Vercel and publish the setup and demo instructions on GitHub.

## Definition of done

- A visitor can play, edit, and export the sample without an account or API key.
- A supported short audio file returns timestamped text, and clicking a timestamp jumps to the corresponding recording position.
- Both downloads reflect the latest edits, and the SRT opens in a subtitle compatible player.
- Oversized, unsupported, silent, and failed uploads each show a clear next step. The sample remains available when live uploads are unavailable.
- Upload, playback, editing, and download controls work on mobile and with a keyboard.
- The GitHub README links to the live Vercel demo and explains how to enable live uploads locally.
