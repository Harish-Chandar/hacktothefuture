// Shared chrome.storage helpers for the popup, background worker, and viewer.
//   local:   settings, the user's last selections (prefs), and new-tab views
//   session: per-tab job status, so the popup can show progress after reopening

import { DEFAULT_MIN_TEXT_SIZE } from "./requirements.js";

export const DEFAULT_SETTINGS = {
	serverUrl: "http://127.0.0.1:5000",
	// The server has no /reformat endpoint yet, so start in demo mode.
	mock: true,
};

export const DEFAULT_PREFS = {
	selected: [],
	other: "",
	output: "in-place",
	minTextSize: DEFAULT_MIN_TEXT_SIZE,
};

export async function getSettings() {
	const { settings } = await chrome.storage.local.get("settings");
	return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings) {
	await chrome.storage.local.set({ settings });
}

export async function getPrefs() {
	const { prefs } = await chrome.storage.local.get("prefs");
	return { ...DEFAULT_PREFS, ...prefs };
}

export async function savePrefs(prefs) {
	await chrome.storage.local.set({ prefs });
}

const jobKey = (tabId) => `job:${tabId}`;

export async function getJob(tabId) {
	const key = jobKey(tabId);
	return (await chrome.storage.session.get(key))[key];
}

export async function setJob(tabId, job) {
	await chrome.storage.session.set({ [jobKey(tabId)]: job });
}

export async function clearJob(tabId) {
	await chrome.storage.session.remove(jobKey(tabId));
}

export function onJobChange(tabId, callback) {
	chrome.storage.onChanged.addListener((changes, area) => {
		const change = changes[jobKey(tabId)];
		if (area === "session" && change) callback(change.newValue);
	});
}

const VIEW_PREFIX = "view:";
const MAX_VIEWS = 5;

export async function saveView(view) {
	const id = crypto.randomUUID();
	await chrome.storage.local.set({ [VIEW_PREFIX + id]: { ...view, createdAt: Date.now() } });
	await pruneViews();
	return id;
}

export async function getView(id) {
	const key = VIEW_PREFIX + id;
	return (await chrome.storage.local.get(key))[key];
}

// Reformatted pages can be large, so only keep the most recent few.
async function pruneViews() {
	const everything = await chrome.storage.local.get(null);
	const stale = Object.entries(everything)
		.filter(([key]) => key.startsWith(VIEW_PREFIX))
		.sort(([, a], [, b]) => b.createdAt - a.createdAt)
		.slice(MAX_VIEWS)
		.map(([key]) => key);
	if (stale.length) await chrome.storage.local.remove(stale);
}
