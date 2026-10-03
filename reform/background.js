// Runs reformat jobs. The popup closes as soon as the user clicks the page, so the
// slow work (reading the page, calling the server, applying the result) happens
// here, and progress is written to session storage for the popup to display.

import { capturePage, applyReformattedHtml } from "./page-scripts.js";
import { mockReformat } from "./mock.js";
import { getSettings, setJob, clearJob, saveView } from "./storage.js";

const REQUEST_TIMEOUT_MS = 120_000;

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
		const settings = await getSettings();

		await update({
			state: "working",
			message: settings.mock ? "Applying demo changes…" : "Asking the AI to reformat the page…",
		});
		const result = settings.mock
			? await mockReformat(page.html, requirements, other)
			: await requestReformat(settings.serverUrl, { ...page, requirements, other });

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

// Contract with the server. See reform/README.md.
async function requestReformat(serverUrl, body) {
	const endpoint = `${serverUrl.replace(/\/+$/, "")}/reformat`;
	let response;
	try {
		response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
	} catch (error) {
		if (error.name === "TimeoutError") throw new Error("The server took too long to respond. Try again, or pick fewer options.");
		throw new Error(`Can't reach the server at ${serverUrl}. Is it running? You can also turn on demo mode in Settings.`);
	}

	const data = await response.json().catch(() => null);
	if (!response.ok) throw new Error(data?.error || `The server returned an error (${response.status}).`);
	if (typeof data?.html !== "string" || !data.html.trim()) throw new Error("The server's response didn't include any HTML.");
	return { html: data.html, changes: Array.isArray(data.changes) ? data.changes : [] };
}

function friendlyError(error) {
	const message = error?.message || String(error);
	if (/cannot access|cannot be scripted|extensions gallery/i.test(message)) {
		return "Reform can't change this page. Browser pages and the Chrome Web Store are protected.";
	}
	return message;
}
