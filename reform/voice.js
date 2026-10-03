// Records speech in the side panel and turns it into text with the server's
// Parakeet endpoint: POST /transcribe, multipart form field "audio" (WebM),
// responding { success: true, text }.

import { SERVER_URL } from "./config.js";

const TRANSCRIBE_TIMEOUT_MS = 90_000;

let recording = null;

export function isRecording() {
	return recording !== null;
}

export async function startRecording() {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
	const chunks = [];
	recorder.addEventListener("dataavailable", (event) => {
		if (event.data.size) chunks.push(event.data);
	});
	const finished = new Promise((resolve) => {
		recorder.addEventListener("stop", () => {
			stream.getTracks().forEach((track) => track.stop());
			resolve(new Blob(chunks, { type: "audio/webm" }));
		});
	});
	recorder.start();
	recording = { recorder, finished };
}

export async function stopAndTranscribe() {
	const { recorder, finished } = recording;
	recording = null;
	recorder.stop();
	const audio = await finished;
	if (!audio.size) throw new Error("No audio was recorded. Please try again.");

	const form = new FormData();
	form.append("audio", audio, "speech.webm");

	let response;
	try {
		response = await fetch(`${SERVER_URL}/transcribe`, {
			method: "POST",
			body: form,
			signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
		});
	} catch (error) {
		if (error.name === "TimeoutError") throw new Error("Transcription took too long. Please try again.");
		throw new Error(`Can't reach the server at ${SERVER_URL}. Is it running?`);
	}

	const data = await response.json().catch(() => null);
	if (!response.ok || !data?.success) {
		throw new Error(data?.error || `Transcription failed (${response.status}).`);
	}
	return (data.text ?? "").trim();
}
