import { REQUIREMENT_GROUPS, PRESETS, DEFAULT_MIN_TEXT_SIZE, buildRequirements } from "./requirements.js";
import { getSettings, saveSettings, getPrefs, savePrefs, getJob, clearJob, onJobChange } from "./storage.js";
import { isReformatted, restoreOriginalPage } from "./page-scripts.js";

const $ = (id) => document.getElementById(id);

const form = $("reform-form");
let tab;

init();

async function init() {
	renderRequirements();
	renderPresets();

	const [settings, prefs, [activeTab]] = await Promise.all([
		getSettings(),
		getPrefs(),
		chrome.tabs.query({ active: true, currentWindow: true }),
	]);
	tab = activeTab;

	applySettings(settings);
	applyPrefs(prefs);
	wireEvents();

	if (!/^https?:/.test(tab?.url ?? "")) {
		disableForm("Open a regular website (http or https) to reformat it. Browser pages like this one can't be changed.");
		return;
	}

	const site = $("site");
	site.replaceChildren("Reformatting ", Object.assign(document.createElement("strong"), { textContent: new URL(tab.url).hostname }));
	site.hidden = false;

	renderJob(await getJob(tab.id));
	onJobChange(tab.id, (job) => {
		renderJob(job);
		refreshRestoreButton();
	});
	refreshRestoreButton();
}

// Rendering

function renderRequirements() {
	const container = $("requirements");
	for (const group of REQUIREMENT_GROUPS) {
		const fieldset = document.createElement("fieldset");
		const legend = document.createElement("legend");
		legend.textContent = group.label;
		fieldset.append(legend);

		for (const item of group.items) {
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
			fieldset.append(label);

			if (item.hasValue) fieldset.append(renderMinTextSize());
		}
		container.append(fieldset);
	}
}

function renderMinTextSize() {
	const row = document.createElement("div");
	row.className = "inline-setting";
	row.id = "min-text-size-row";
	row.innerHTML = `
		<label for="min-text-size">Minimum size (px)</label>
		<input id="min-text-size" type="number" min="12" max="40" step="1">`;
	return row;
}

function renderPresets() {
	const container = $("presets");
	for (const preset of PRESETS) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "chip";
		button.textContent = preset.label;
		button.dataset.preset = preset.id;
		button.setAttribute("aria-pressed", "false");
		button.addEventListener("click", () => applyPreset(preset));
		container.append(button);
	}
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
	$("restore").hidden = !(await runInTab(isReformatted).catch(() => false));
}

function disableForm(message) {
	form.hidden = true;
	document.querySelector(".presets").hidden = true;
	const note = document.createElement("p");
	note.className = "disabled-note";
	note.textContent = message;
	document.querySelector("main").prepend(note);
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
	syncDerivedState();
}

function applyPreset(preset) {
	for (const input of form.querySelectorAll('input[name="requirement"]')) {
		input.checked = preset.requirements.includes(input.value);
	}
	syncDerivedState();
	savePrefs(readPrefs());
}

// Keeps preset chips and the min-size row in sync with the checkboxes.
function syncDerivedState() {
	const selected = selectedIds();
	for (const chip of document.querySelectorAll(".chip")) {
		const preset = PRESETS.find((p) => p.id === chip.dataset.preset);
		const matches = preset.requirements.length === selected.length && preset.requirements.every((id) => selected.includes(id));
		chip.setAttribute("aria-pressed", String(matches));
	}
	$("min-text-size-row").hidden = !$("req-min-text-size").checked;
}

function applySettings(settings) {
	$("server-url").value = settings.serverUrl;
	$("mock").checked = settings.mock;
	$("demo-badge").hidden = !settings.mock;
}

async function saveSettingsFromForm() {
	const serverUrl = $("server-url").value.trim();
	const settings = { serverUrl: serverUrl || (await getSettings()).serverUrl, mock: $("mock").checked };
	await saveSettings(settings);
	$("demo-badge").hidden = !settings.mock;
}

// Events

function wireEvents() {
	form.addEventListener("change", () => {
		syncDerivedState();
		hideFormError();
		savePrefs(readPrefs());
	});
	$("other").addEventListener("input", () => {
		hideFormError();
		savePrefs(readPrefs());
	});
	form.addEventListener("submit", onSubmit);
	$("restore").addEventListener("click", onRestore);
	$("server-url").addEventListener("change", saveSettingsFromForm);
	$("mock").addEventListener("change", saveSettingsFromForm);
}

async function onSubmit(event) {
	event.preventDefault();
	const prefs = readPrefs();
	if (!prefs.selected.length && !prefs.other.trim()) {
		showFormError("Pick at least one option, or describe what you need.");
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
