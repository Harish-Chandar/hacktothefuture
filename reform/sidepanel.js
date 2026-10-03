import { REQUIREMENTS, DEFAULT_MIN_TEXT_SIZE, buildRequirements } from "./requirements.js";
import { getPrefs, savePrefs, getJob, clearJob, onJobChange } from "./storage.js";
import { isReformatted, restoreOriginalPage } from "./page-scripts.js";

const $ = (id) => document.getElementById(id);

const form = $("reform-form");

// The side panel stays open while the user switches tabs, so it always works
// on whichever tab is currently active in its window.
let tab;

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
		refreshRestoreButton();
	});

	await loadActiveTab();
}

async function loadActiveTab() {
	[tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	const supported = /^https?:/.test(tab?.url ?? "");

	form.hidden = !supported;
	$("unsupported").hidden = supported;
	$("site").hidden = !supported;
	if (!supported) {
		renderJob(null);
		$("restore").hidden = true;
		return;
	}

	const host = Object.assign(document.createElement("strong"), { textContent: new URL(tab.url).hostname });
	$("site").replaceChildren("Reformatting ", host);
	renderJob(await getJob(tab.id));
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
	if (!job) return;

	status.dataset.state = job.state;
	const line = document.createElement("p");
	line.className = "status-line";

	if (job.state === "working") {
		const spinner = document.createElement("span");
		spinner.className = "spinner";
		spinner.setAttribute("aria-hidden", "true");
		line.append(spinner);
		submit.disabled = true;
		submit.textContent = "Working…";
	} else {
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
	};
}

function applyPrefs(prefs) {
	for (const input of form.querySelectorAll('input[name="requirement"]')) {
		input.checked = prefs.selected.includes(input.value);
	}
	$("other").value = prefs.other;
	$("min-text-size").value = prefs.minTextSize;
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
	$("restore").addEventListener("click", onRestore);
}

async function onSubmit(event) {
	event.preventDefault();
	const prefs = readPrefs();
	if (!prefs.selected.length && !prefs.other.trim()) {
		showFormError("Pick at least one option, or tell the AI what you need.");
		return;
	}
	await savePrefs(prefs);
	await chrome.runtime.sendMessage({
		type: "reformat",
		tabId: tab.id,
		requirements: buildRequirements(prefs.selected, { minTextSize: prefs.minTextSize }),
		other: prefs.other.trim(),
		output: prefs.output,
	});
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
