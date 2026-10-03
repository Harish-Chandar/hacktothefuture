// Runs reformat jobs. The slow work (reading the page, calling the server,
// applying the result) happens here rather than in the side panel, and progress
// is written to session storage so the panel can show it for whichever tab is active.

import { capturePage, applyReformattedHtml } from "./page-scripts.js";
import { buildPrompt, extractHtml } from "./prompt.js";
import { setJob, clearJob, saveView } from "./storage.js";
import { SERVER_URL } from "./config.js";
const REQUEST_TIMEOUT_MS = 120_000;

// Clicking the toolbar icon opens the side panel, which squeezes the page
// instead of covering it like a popup would.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type !== "reformat") return;
	runJob(message);
	sendResponse({ started: true });
});

// A finished job no longer describes the page once the tab navigates or closes.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (changeInfo.status === "loading") clearJob(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => clearJob(tabId));

async function runJob({ tabId, requirements, other, output }) {
	const jobId = crypto.randomUUID();
	const update = (fields) => setJob(tabId, { jobId, output, ...fields });

	try {
		await update({ state: "working", message: "Reading the page…" });
		const page = await runInTab(tabId, capturePage);
		await update({ state: "working", message: "Asking the AI to reformat the page…" });
		const result = await requestReformat({ ...page, requirements, other });

		if (output === "new-tab") {
			const viewId = await saveView({ url: page.url, title: page.title, html: result.html, changes: result.changes });
			const tab = await chrome.tabs.get(tabId);
			await chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?id=${viewId}`), index: tab.index + 1 });
		} else {
			await runInTab(tabId, applyReformattedHtml, [result.html]);
		}

		await update({
			state: "done",
			message: output === "new-tab" ? "Opened the reformatted page in a new tab." : "Page reformatted.",
			changes: result.changes,
		});
	} catch (error) {
		await update({ state: "error", message: friendlyError(error) });
	}
}

async function runInTab(tabId, func, args = []) {
	const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
	return injection.result;
}

// Uses the server's POST /ask-gemini endpoint: { prompt } -> { text }.
async function requestReformat(page) {
	const endpoint = `${SERVER_URL}/ask-gemini`;
	let response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt: buildPrompt(page) }),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (error) {
		if (error.name === "TimeoutError") throw new Error("The server took too long to respond. Please try again.");
		throw new Error(`Can't reach the server at ${SERVER_URL}. Is it running? (cd server && npm start)`);
	}

	if (response.status === 413) throw new Error("This page is too big for the server to accept.");
	const data = await response.json().catch(() => null);
	// The server reports failures as { ok: false, error } (usually with status 200).
	if (!response.ok || data?.ok === false) {
		throw new Error(data?.error || `The server returned an error (${response.status}).`);
	}

	const html = typeof data?.text === "string" ? extractHtml(data.text) : null;
	if (!html) throw new Error("The AI didn't send back a web page. Please try again.");

	const changes = page.requirements.map((requirement) => requirement.label);
	if (page.other) changes.push(`Your request: "${page.other}"`);
	return { html, changes };
}

function friendlyError(error) {
	const message = error?.message || String(error);
	if (/cannot access|cannot be scripted|extensions gallery/i.test(message)) {
		return "Reform can't change this page. Browser pages and the Chrome Web Store are protected.";
	}
	return message;
}
