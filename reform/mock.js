// Offline stand-in for the server, used in demo mode. It applies each option
// with plain CSS so the extension can be demoed without the server or Gemini.
// It can't follow free-text requests, so those are reported as skipped.

const DELAY_MS = 700;

const RULES = {
	contrast: {
		css: () => `
html, body { background-color: #ffffff !important; }
body *:not(img):not(video):not(picture):not(canvas):not(svg):not(svg *) {
	color: #111111 !important;
	background-color: transparent !important;
	background-image: none !important;
	text-shadow: none !important;
}
body a, body a * { color: #0b3d91 !important; text-decoration: underline !important; }
body button, body input, body select, body textarea {
	background-color: #ffffff !important;
	border: 2px solid #111111 !important;
}
body ::placeholder { color: #444444 !important; opacity: 1 !important; }`,
		summary: () => "Switched to dark text on a white background for strong contrast.",
	},
	"min-text-size": {
		css: ({ value }) => `
html { font-size: max(100%, ${value}px) !important; }
body p, body li, body a, body span, body div, body td, body th, body label, body dd, body dt,
body blockquote, body figcaption, body small, body button, body input, body select, body textarea {
	font-size: max(1em, ${value}px) !important;
	line-height: 1.5 !important;
}`,
		summary: ({ value }) => `Made all text at least ${value}px.`,
	},
	"simple-layout": {
		css: () => `
body { max-width: 60rem !important; margin: 0 auto !important; padding: 1rem !important; }
body *:not(svg *) {
	float: none !important;
	grid-template-columns: none !important;
	grid-template-areas: none !important;
	grid-column: auto !important;
	grid-row: auto !important;
	flex-wrap: wrap !important;
	max-width: 100% !important;
}
body header, body nav, body [style*="fixed"], body [style*="sticky"] { position: static !important; }
body main, body article, body section, body aside, body header, body footer, body nav {
	display: block !important;
	width: auto !important;
}
body img, body video { height: auto !important; }`,
		summary: () => "Rearranged the page into a single centered column.",
	},
};

export async function mockReformat(html, requirements, other) {
	await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

	const css = [];
	const changes = [];
	for (const requirement of requirements) {
		const rule = RULES[requirement.id];
		css.push(rule.css(requirement));
		changes.push(rule.summary(requirement));
	}
	if (other) changes.push("Skipped your written request (demo mode can't use AI).");

	const style = `<style id="reform-demo">${css.join("\n")}\n</style>`;
	const output = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => `${style}</head>`) : style + html;
	return { html: output, changes };
}
