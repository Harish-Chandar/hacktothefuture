// Builds the prompt for the server's /ask-gemini endpoint, which forwards
// `prompt` to Gemini as-is, so every instruction the model sees lives here.

const INSTRUCTIONS = `You are given the HTML source of a web page and a user's accessibility needs. Rewrite the page so it meets those needs.

Rules:
- Return ONLY the complete new HTML document, starting with <!DOCTYPE html>. No explanation and no Markdown code fences.
- Keep all of the page's content, links, images, and forms. Do not invent new content.
- Keep URLs exactly as they are, including relative ones.
- Put style changes in a <style> block in the <head> or in inline styles.
- Do not add any <script> tags.`;

export function buildPrompt({ url, title, html, requirements, other }) {
	const needs = requirements.map((requirement) => `- ${requirement.instruction}`);
	if (other) needs.push(`- The user also asked: ${other}`);

	return `${INSTRUCTIONS}

The user's needs:
${needs.join("\n")}

Page URL: ${url}
Page title: ${title}

HTML source:
${html}`;
}

// Gemini sometimes wraps the page in a Markdown code fence or adds a sentence
// before it. Returns null when the reply doesn't contain a page at all.
export function extractHtml(text) {
	const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
	let html = (fenced ? fenced[1] : text).trim();
	const start = html.search(/<!doctype html|<html[\s>]/i);
	if (start > 0) html = html.slice(start);
	return /<(html|body)[\s>]/i.test(html) ? html : null;
}
