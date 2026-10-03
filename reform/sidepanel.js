import { REQUIREMENTS, DEFAULT_MIN_TEXT_SIZE, buildRequirements } from "./requirements.js";
import { getPrefs, savePrefs, getJob, clearJob, onJobChange, getSummary, saveSummary } from "./storage.js";
import { capturePage, isReformatted, restoreOriginalPage } from "./page-scripts.js";
import { isRecording, startRecording, stopAndTranscribe } from "./voice.js";
import { SERVER_URL } from "./config.js";

const $ = (id) => document.getElementById(id);

const form = $("reform-form");
const COLOR_VISION_VALUES = ["none", "protan", "deutan", "tritan", "achromatopsia"];

// The side panel stays open while the user switches tabs, so it always works
// on whichever tab is currently active in its window.
let tab;
let pendingPostAction = false;
let summary;

init();

async function init() {
	renderRequirements();

	applyPrefs(await getPrefs());
	wireEvents();

	chrome.tabs.onActivated.addListener(({ windowId }) => {
		if (windowId === tab?.windowId) loadActiveTab();
	});
	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (tabId === tab?.id && (changeInfo.url || changeInfo.status === "complete")) loadActiveTab();
	});
	onJobChange((tabId, job) => {
		if (tabId !== tab?.id) return;
		renderJob(job);
		if (job?.state === "error") showApiError(job.message);
		refreshRestoreButton();
	});

	await loadActiveTab();
}

async function loadActiveTab() {
	[tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	const supported = /^https?:/.test(tab?.url ?? "");

	form.hidden = !supported;
	$("unsupported").hidden = supported;
	showReformPane();
	if (!supported) {
		renderJob(null);
		setPostPending(false);
		renderSummaryButton(null);
		$("restore").hidden = true;
		return;
	}

	renderJob(await getJob(tab.id));
	summary = await getSummary(tab.id);
	if (summary?.url !== tab.url) summary = null;
	renderSummaryButton(summary);
	refreshRestoreButton();
}

// Rendering

function renderRequirements() {
	const container = $("requirements");
	for (const item of REQUIREMENTS) {
		const label = document.createElement("label");
		label.className = "option";
		label.innerHTML = `
			<input type="checkbox" name="requirement">
			<span>
				<span class="option-title"></span>
				<span class="option-hint"></span>
			</span>`;
		const checkbox = label.querySelector("input");
		checkbox.value = item.id;
		checkbox.id = `req-${item.id}`;
		label.querySelector(".option-title").textContent = item.label;
		label.querySelector(".option-hint").textContent = item.hint;
		container.append(label);

		if (item.hasValue) container.append(renderMinTextSize());
	}
}

function renderMinTextSize() {
	const row = document.createElement("div");
	row.className = "inline-setting";
	row.id = "min-text-size-row";
	row.innerHTML = `
		<label for="min-text-size">Smallest size (px)</label>
		<input id="min-text-size" type="number" min="12" max="40" step="1">`;
	return row;
}

function renderJob(job) {
	const status = $("status");
	const submit = $("submit");
	status.replaceChildren();
	delete status.dataset.state;
	submit.disabled = false;
	submit.textContent = "Reformat page";
	if (!job) {
		setPostPending(false);
		return;
	}

	status.dataset.state = job.state;
	const line = document.createElement("p");
	line.className = "status-line";

	if (job.state === "working") {
		const spinner = document.createElement("span");
		spinner.className = "spinner";
		spinner.setAttribute("aria-hidden", "true");
		line.append(spinner);
		setPostPending("reformat");
	} else {
		setPostPending(false);
		line.append(job.state === "done" ? "✓ " : "⚠ ");
	}
	line.append(job.message);
	status.append(line);

	if (job.state === "done" && job.changes?.length) {
		const list = document.createElement("ul");
		for (const change of job.changes) {
			const item = document.createElement("li");
			item.textContent = change;
			list.append(item);
		}
		status.append(list);
	}
}

async function refreshRestoreButton() {
	const tabId = tab?.id;
	const reformatted = await runInTab(isReformatted).catch(() => false);
	if (tabId === tab?.id) $("restore").hidden = !reformatted;
}

// Form state

function selectedIds() {
	return [...form.querySelectorAll('input[name="requirement"]:checked')].map((input) => input.value);
}

function readPrefs() {
	const size = Number($("min-text-size").value);
	return {
		selected: selectedIds(),
		other: $("other").value,
		output: form.elements.output.value || "in-place",
		minTextSize: Number.isFinite(size) && size >= 12 && size <= 40 ? size : DEFAULT_MIN_TEXT_SIZE,
		colorVision: $("color-vision").value || "none",
	};
}

function applyPrefs(prefs) {
	for (const input of form.querySelectorAll('input[name="requirement"]')) {
		input.checked = prefs.selected.includes(input.value);
	}
	$("other").value = prefs.other;
	$("min-text-size").value = prefs.minTextSize;
	$("color-vision").value = COLOR_VISION_VALUES.includes(prefs.colorVision) ? prefs.colorVision : "none";
	form.elements.output.value = prefs.output;
	syncMinSizeRow();
}

function syncMinSizeRow() {
	$("min-text-size-row").hidden = !$("req-min-text-size").checked;
}

// Events

function wireEvents() {
	form.addEventListener("change", () => {
		syncMinSizeRow();
		hideFormError();
		savePrefs(readPrefs());
	});
	$("other").addEventListener("input", () => {
		hideFormError();
		savePrefs(readPrefs());
	});
	form.addEventListener("submit", onSubmit);
	$("summarize").addEventListener("click", onSummarize);
	$("summary-back").addEventListener("click", showReformPane);
	$("restore").addEventListener("click", onRestore);
	$("mic").addEventListener("click", onMicClick);
}

async function onMicClick() {
	if (!isRecording()) {
		try {
			await startRecording();
		} catch (error) {
			handleMicError(error);
			return;
		}
		setMicState("recording", "Listening… click Stop when you're done.");
		return;
	}

	setMicState("busy", "Transcribing…");
	try {
		const text = await stopAndTranscribe();
		if (!text) {
			setMicState("idle", "Didn't catch any words. Please try again.");
			return;
		}
		const other = $("other");
		other.value = other.value.trim() ? `${other.value.trim()} ${text}` : text;
		hideFormError();
		savePrefs(readPrefs());
		setMicState("idle", "Added what you said to the box.");
	} catch (error) {
		setMicState("idle", `⚠ ${error.message}`);
	}
}

// The side panel can't show the browser's permission prompt, so the first
// time, ask from a regular tab instead.
function handleMicError(error) {
	if (error.name === "NotAllowedError") {
		chrome.tabs.create({ url: chrome.runtime.getURL("mic-permission.html") });
		setMicState("idle", "Allow the microphone in the tab that just opened, then click Speak again.");
	} else if (error.name === "NotFoundError") {
		setMicState("idle", "⚠ No microphone found.");
	} else {
		setMicState("idle", `⚠ Couldn't start recording: ${error.message}`);
	}
}

function setMicState(state, message) {
	const mic = $("mic");
	mic.dataset.state = state;
	mic.disabled = state === "busy";
	mic.setAttribute("aria-pressed", String(state === "recording"));
	$("mic-label").textContent = state === "recording" ? "Stop" : state === "busy" ? "Working…" : "Speak";
	$("mic-status").textContent = message;
}

async function onSubmit(event) {
	event.preventDefault();
	hideApiError();
	const prefs = readPrefs();
	if (!prefs.selected.length && !prefs.other.trim() && prefs.colorVision === "none") {
		showFormError("Pick at least one option, or tell the AI what you need.");
		return;
	}
	await savePrefs(prefs);
	await chrome.runtime.sendMessage({
		type: "reformat",
		tabId: tab.id,
		requirements: buildRequirements(prefs.selected, { minTextSize: prefs.minTextSize }),
		colorVision: prefs.colorVision,
		other: prefs.other.trim(),
		output: prefs.output,
	});
}

async function onSummarize() {
	if (!tab?.id || pendingPostAction) return;
	if (summary) {
		openSummary();
		return;
	}

	hideApiError();
	setPostPending("summarize");

	try {
		const page = await runInTab(capturePage);
		const response = await fetch(`${SERVER_URL}/summarize`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ html: page.html }),
			signal: AbortSignal.timeout(120000),
		});
		const data = await response.json().catch(() => null);

		if (!response.ok || data?.ok === false) {
			throw new Error(apiErrorMessage(data, response.status));
		}
		if (typeof data?.text !== "string" || !data.text.trim()) {
			throw new Error("The server returned an empty summary.");
		}
		summary = {
			url: tab.url,
			title: tab.title || new URL(tab.url).hostname,
			text: data.text.trim(),
		};
		await saveSummary(tab.id, summary);
	} catch (error) {
		showApiError(error.message || "Unable to summarize this page.");
	} finally {
		setPostPending(false);
		renderSummaryButton(summary);
	}
}

function renderSummaryButton(value) {
	const summarize = $("summarize");
	if (summarize && !pendingPostAction) summarize.textContent = value ? "Show summary" : "Summarize page";
}

function openSummary() {
	form.hidden = true;
	$("summary-pane").hidden = false;
	$("status").hidden = true;
	$("restore").hidden = true;
	$("summary-title").textContent = summary.title || "Page summary";
	renderSummaryContent(summary.text);
}

function renderSummaryContent(text) {
	const content = $("summary-content");
	const fragment = document.createDocumentFragment();
	const urlPattern = /https?:\/\/[^\s)]+/gi;
	let lastIndex = 0;

	for (const match of text.matchAll(urlPattern)) {
		const url = match[0].replace(/[.,;:!?]+$/, "");
		const start = match.index;
		fragment.append(text.slice(lastIndex, start));

		const link = document.createElement("a");
		link.href = url;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		link.textContent = url;
		fragment.append(link, match[0].slice(url.length));
		lastIndex = start + match[0].length;
	}

	fragment.append(text.slice(lastIndex));
	content.replaceChildren(fragment);
}

function showReformPane() {
	form.hidden = !/^https?:/.test(tab?.url ?? "");
	$("summary-pane").hidden = true;
	$("status").hidden = false;
	refreshRestoreButton();
}

function setPostPending(action) {
	pendingPostAction = Boolean(action);
	for (const button of document.querySelectorAll(".post-action, #mic")) button.disabled = Boolean(action);

	const submit = $("submit");
	const summarize = $("summarize");
	submit.replaceChildren();
	summarize.replaceChildren();
	if (action === "reformat") {
		const spinner = document.createElement("span");
		spinner.className = "spinner";
		spinner.setAttribute("aria-hidden", "true");
		submit.append(spinner, " Working…");
	} else if (action === "summarize") {
		const spinner = document.createElement("span");
		spinner.className = "spinner";
		spinner.setAttribute("aria-hidden", "true");
		summarize.append(spinner, " Summarizing…");
	} else {
		submit.textContent = "Reformat page";
		renderSummaryButton(summary);
	}
}

function apiErrorMessage(data, status) {
	return data?.message || data?.error || data?.data?.error?.message || `The server returned an error (${status}).`;
}

function showApiError(message) {
	const error = $("api-error");
	error.textContent = message;
	error.hidden = false;
}

function hideApiError() {
	$("api-error").hidden = true;
}

async function onRestore() {
	await runInTab(restoreOriginalPage);
	await clearJob(tab.id);
	renderJob(null);
	refreshRestoreButton();
}

function showFormError(message) {
	const error = $("form-error");
	error.textContent = message;
	error.hidden = false;
}

function hideFormError() {
	$("form-error").hidden = true;
}

async function runInTab(func) {
	const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func });
	return injection.result;
}
