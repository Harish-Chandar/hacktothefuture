// Shows a reformatted page in its own tab. The page is rendered in a sandboxed
// iframe with scripts disabled, and a <base> tag keeps its images, styles, and
// links pointing at the original site.

import { getView } from "./storage.js";

const $ = (id) => document.getElementById(id);

const id = new URLSearchParams(location.search).get("id");
const view = id ? await getView(id) : null;

if (view) {
	document.title = `Reformatted: ${view.title || new URL(view.url).hostname}`;
	$("original").href = view.url;
	$("frame").srcdoc = prepareForFrame(view.html, view.url);

	if (view.changes?.length) {
		$("changes-list").append(
			...view.changes.map((change) => Object.assign(document.createElement("li"), { textContent: change })),
		);
		$("changes").hidden = false;
	}
} else {
	$("frame").hidden = true;
	$("original").hidden = true;
	$("message").textContent = "This reformatted page has expired. Go back to the original tab and reformat it again.";
	$("message").hidden = false;
}

function prepareForFrame(html, url) {
	const doc = new DOMParser().parseFromString(html, "text/html");
	doc.querySelectorAll("script, base").forEach((node) => node.remove());
	const base = doc.createElement("base");
	base.href = url;
	base.target = "_blank";
	doc.head.prepend(base);
	return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}
