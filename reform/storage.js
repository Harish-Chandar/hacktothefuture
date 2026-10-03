// Shared chrome.storage helpers for the side panel, background worker, and viewer.
//   local:   the user's last selections (prefs) and new-tab views
//   session: per-tab job status, so the panel can show progress for the active tab

import { DEFAULT_MIN_TEXT_SIZE } from "./requirements.js";

export const DEFAULT_PREFS = {
	selected: [],
	other: "",
	output: "in-place",
	minTextSize: DEFAULT_MIN_TEXT_SIZE,
};

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

// Calls back with (tabId, job) whenever any tab's job changes.
export function onJobChange(callback) {
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "session") return;
		for (const [key, change] of Object.entries(changes)) {
			if (key.startsWith("job:")) callback(Number(key.slice("job:".length)), change.newValue);
		}
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
