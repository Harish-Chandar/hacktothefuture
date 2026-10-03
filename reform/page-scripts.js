// These functions run inside the web page through chrome.scripting.executeScript,
// so each one must be self-contained: no imports and no outside variables.
// `window.__reformOriginalRoot` lives in the extension's isolated world and keeps
// the page's original <html> element so it can be restored with its listeners intact.

export function capturePage() {
	const root = (window.__reformOriginalRoot || document.documentElement).cloneNode(true);
	root.querySelectorAll("script, noscript, template").forEach((node) => node.remove());

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
	const comments = [];
	while (walker.nextNode()) comments.push(walker.currentNode);
	comments.forEach((comment) => comment.remove());

	return {
		url: location.href,
		title: document.title,
		html: `<!DOCTYPE html>\n${root.outerHTML}`,
	};
}

export function applyReformattedHtml(html) {
	const parsed = new DOMParser().parseFromString(html, "text/html");

	// Never run code from the model's output: drop scripts, inline event
	// handlers, and javascript: URLs.
	parsed.querySelectorAll("script").forEach((node) => node.remove());
	for (const element of parsed.querySelectorAll("*")) {
		for (const { name, value } of [...element.attributes]) {
			const isHandler = name.toLowerCase().startsWith("on");
			const isScriptUrl = /^(href|src|action|formaction)$/i.test(name) && /^\s*javascript:/i.test(value);
			if (isHandler || isScriptUrl) element.removeAttribute(name);
		}
	}

	const root = document.importNode(parsed.documentElement, true);
	if (!window.__reformOriginalRoot) window.__reformOriginalRoot = document.documentElement;
	document.replaceChild(root, document.documentElement);
	window.scrollTo(0, 0);
	return true;
}

export function restoreOriginalPage() {
	const original = window.__reformOriginalRoot;
	if (!original) return false;
	document.replaceChild(original, document.documentElement);
	delete window.__reformOriginalRoot;
	return true;
}

export function isReformatted() {
	return Boolean(window.__reformOriginalRoot);
}
