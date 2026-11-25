# dc-transcriber — Audio Transcript Builder

A workspace for listening to audio, editing a timestamped transcript, and exporting TXT or SRT subtitles. The bundled sample works without a key. Audio and drafts are not saved by the app; refreshing clears your work.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. Choose **Try the sample** or select an MP3, WAV, or M4A recording and click **Transcribe audio**. Click a timestamp to seek and play, edit the text directly, and download TXT or SRT.

## Browser transcription

Transcription runs on your device using Transformers.js and the English Whisper tiny model. No transcription API key or paid transcription service is required. The first transcription needs an internet connection to download the model from Hugging Face; the browser may cache it for later use. Audio is processed locally and is not sent to a transcription server by the app. Hosting the app and downloading model files can still use network bandwidth.

Recordings are processed sequentially in parts of up to 5 minutes. Only the first 30 minutes are transcribed and available for playback. The full input is decoded before splitting, so large recordings may be slow or fail, especially on mobile devices. Browser support for audio formats varies. Accuracy and timestamps are model-generated: review them before export. The app does not provide speaker labels or save drafts.

Deploy this folder as the project root with the Next.js preset. No transcription environment variables are needed.
