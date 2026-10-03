import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
	buildGeminiPrompt,
	colorVisionPromptSection,
	normalizeColorVision
} from "../src/server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sidepanelPath = path.join(__dirname, "../../reform/sidepanel.html");

test("side panel color vision select exposes the exact supported values", async () => {
	const html = await readFile(sidepanelPath, "utf8");
	const select = html.match(/<select id="color-vision">([\s\S]*?)<\/select>/);

	assert.ok(select, "color vision select should exist");
	assert.match(html, /<label for="color-vision">Color vision support<\/label>/);
	assert.deepEqual([...select[1].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map((match) => ({
		value: match[1],
		label: match[2]
	})), [
		{ value: "none", label: "Default (no color vision adjustments)" },
		{ value: "protan", label: "Red deficiency (Protan)" },
		{ value: "deutan", label: "Green deficiency (Deutan)" },
		{ value: "tritan", label: "Blue-yellow deficiency (Tritan)" },
		{ value: "achromatopsia", label: "Little or no color perception (Achromatopsia)" }
	]);
});

test("none and omitted color vision settings add no profile-specific instructions", () => {
	assert.equal(normalizeColorVision(undefined), "none");
	assert.equal(colorVisionPromptSection("none"), "");
	assert.equal(colorVisionPromptSection(undefined), "");
	assert.equal(buildGeminiPrompt("USER PROMPT", "none").includes("Color vision support requirements:"), false);
	assert.match(buildGeminiPrompt("USER PROMPT", undefined), /USER PROMPT/);
});

test("unsupported color vision settings are rejected", () => {
	assert.throws(() => normalizeColorVision("monochrome"), /Unsupported colorVision setting/);
	assert.throws(() => colorVisionPromptSection(""), /Unsupported colorVision setting/);
	assert.throws(() => buildGeminiPrompt("USER PROMPT", "red-green"), /Unsupported colorVision setting/);
});

test("non-default color vision profiles append matching instructions", () => {
	const expectedPhrases = {
		protan: "Adapt meaningful interface colors for red color vision deficiency.",
		deutan: "Adapt meaningful interface colors for green color vision deficiency.",
		tritan: "Adapt meaningful interface colors for blue-yellow color vision deficiency.",
		achromatopsia: "Make important information understandable without color perception."
	};

	for (const [profile, phrase] of Object.entries(expectedPhrases)) {
		const prompt = buildGeminiPrompt("ORIGINAL USER PROMPT", profile);
		assert.match(prompt, /ORIGINAL USER PROMPT/);
		assert.match(prompt, new RegExp(escapeRegExp(phrase)));
		assert.match(prompt, /Do not simulate the deficiency or simply apply a full-page color filter/);
		assert.match(prompt, /Preserve original content, meaning, links, form destinations, accessible names, and semantic HTML/);
	}
});

function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
