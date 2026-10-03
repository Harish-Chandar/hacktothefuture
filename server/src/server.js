import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({
	origin(origin, callback) {
		if (!origin || origin.startsWith("chrome-extension://")) {
			callback(null, true);
			return;
		}

		callback(new Error("Origin not allowed by CORS"));
	}
}));

import multer from "multer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(
	"/voice-test",
	express.static(path.join(__dirname, "../voice-test"))
);
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5000);

const gemini_prompt = "You're given an HTML page and a user's request to update that page. Return ONLY the complete updated HTML source of the page, with no Markdown code fence and no explanation. Preserve the page's original meaning unless the user asks for a change. If the user asks for accessibility improvements, fix color contrast, add alt text to images, use semantic HTML, and ensure interactive elements are keyboard accessible.";
const models = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"];

const API_KEY = process.env.GEMINI;

app.get("/", (_request, response) => {
	response.json({ status: "ok" });
});

app.use(express.json({ limit: "5mb" }));

app.post("/ask-gemini", async (request, response) => {
	const prompt = request.body.prompt;

	if (!API_KEY) {
		response.json({ ok: false, error: "Missing GEMINI in server/.env." });
		return;
	}

	if (!prompt) {
		response.json({ ok: false, error: "Missing prompt." });
		return;
	}

	let lastError = "Gemini returned no response.";

	for (const model of models) {
		const geminiResponse = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-goog-api-key": API_KEY
				},
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: `${gemini_prompt}\n\n${prompt}`
								}
							]
						}
					]
				})
			}
		);

		const data = await geminiResponse.json();
		console.log(JSON.stringify({ model, status: geminiResponse.status, data }, null, 2));

		if (!geminiResponse.ok) {
			lastError = data.error?.message ?? `Gemini returned HTTP ${geminiResponse.status}.`;
			continue;
		}

		const text = data.candidates?.[0]?.content?.parts?.[0]?.text
			?.replace(/^```html\s*/i, "")
			?.replace(/^```\s*/i, "")
			?.replace(/```$/i, "")
			?.trim();

		if (text) {
			response.json({ ok: true, text });
			return;
		}

		lastError = "Gemini response did not include HTML text.";
	}

	response.json({
		ok: false,
		error: lastError
	});
});

app.use((error, _request, response, _next) => {
	console.error(error);
	response.json({
		ok: false,
		error: error.message ?? "Server error."
	});
});
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 10 * 1024 * 1024 }
});

const execFileAsync = promisify(execFile);

const PARAKEET_URL =
	"https://1598d209-5e27-4d3c-8079-4751568b1081.invocation.api.nvcf.nvidia.com/v1/audio/transcriptions";

app.post("/transcribe", upload.single("audio"), async (req, res) => {
	if (!req.file) {
		return res.status(400).json({
			error: "No audio file received"
		});
	}

	if (!process.env.NVIDIA_API_KEY) {
		return res.status(500).json({
			error: "NVIDIA API key missing"
		});
	}

	let tempDir;

	try {
		// Create temporary files for audio conversion.
		tempDir = await mkdtemp(path.join(os.tmpdir(), "parakeet-"));

		const inputPath = path.join(tempDir, "input.webm");
		const outputPath = path.join(tempDir, "audio.wav");

		await writeFile(inputPath, req.file.buffer);

		// Convert browser audio to 16 kHz, mono WAV.
		await execFileAsync("ffmpeg", [
			"-y",
			"-i", inputPath,
			"-ar", "16000",
			"-ac", "1",
			"-c:a", "pcm_s16le",
			outputPath
		], { timeout: 30000 });

		const audio = await readFile(outputPath);

		// Prepare NVIDIA's multipart request.
		const form = new FormData();

		form.append(
			"file",
			new Blob([audio], { type: "audio/wav" }),
			"audio.wav"
		);

		form.append("language", "en-US");

		// Call NVIDIA Parakeet.
		const response = await fetch(PARAKEET_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`
			},
			body: form,
			signal: AbortSignal.timeout(60000)
		});

		if (!response.ok) {
			console.error("Parakeet status:", response.status);

			return res.status(502).json({
				error: "Parakeet transcription failed",
				status: response.status
			});
		}

		const result = await response.json();

		return res.json({
			success: true,
			text: result.text ?? ""
		});

	} catch (error) {
		console.error("Transcription error:", error);

		return res.status(500).json({
			error: "Unable to transcribe recording"
		});

	} finally {
		if (tempDir) {
			await rm(tempDir, {
				recursive: true,
				force: true
			});
		}
	}
});


app.listen(port, host, () => {
	console.log(`API listening at http://${host}:${port}`);
});
