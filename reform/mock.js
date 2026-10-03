// Offline stand-in for the server, used in demo mode. It applies each requirement
// with plain CSS so the extension can be demoed before the AI endpoint exists.
// It cannot rewrite text, so plain language and the "Anything else?" box are
// reported as skipped.

const DELAY_MS = 700;

const NOT_MEDIA = ":not(img):not(video):not(picture):not(canvas):not(svg):not(svg *)";

function colorScheme({ background, text, link, border }) {
	return `
html, body { background-color: ${background} !important; }
body *${NOT_MEDIA} {
	color: ${text} !important;
	background-color: transparent !important;
	background-image: none !important;
	text-shadow: none !important;
}
body a, body a * { color: ${link} !important; text-decoration: underline !important; }
body button, body input, body select, body textarea {
	background-color: ${background} !important;
	border: 2px solid ${border} !important;
}
body ::placeholder { color: ${text} !important; opacity: 0.8 !important; }`;
}

const RULES = {
	contrast: {
		css: () => colorScheme({ background: "#ffffff", text: "#111111", link: "#0b3d91", border: "#111111" }),
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
body main, body article, body section, body aside, body header, body footer, body nav,
body [class*="grid" i], body [class*="columns" i] {
	display: block !important;
	width: auto !important;
	max-width: 100% !important;
}
body img, body video { max-width: 100% !important; height: auto !important; }`,
		summary: () => "Rearranged the page into a single centered column.",
	},
	dyslexia: {
		css: () => `
body, body *:not(svg *):not([class*="icon" i]):not([class*="fa-"]) {
	font-family: Verdana, Tahoma, Arial, sans-serif !important;
	letter-spacing: 0.05em !important;
	word-spacing: 0.12em !important;
	font-style: normal !important;
}
body p, body li, body dd, body blockquote {
	line-height: 1.7 !important;
	text-align: left !important;
	max-width: 70ch;
}`,
		summary: () => "Used a clearer font with extra spacing and left-aligned text.",
	},
	"color-blind": {
		css: () => `
body a { text-decoration: underline !important; text-decoration-thickness: 2px !important; text-underline-offset: 3px !important; }
body input, body select, body textarea { border: 2px solid currentColor !important; }
body [aria-invalid="true"] { outline: 3px dashed currentColor !important; }`,
		summary: () => "Underlined links and outlined form fields so meaning doesn't depend on color.",
	},
	"dark-mode": {
		css: () => colorScheme({ background: "#000000", text: "#f5f5f5", link: "#8ab4ff", border: "#f5f5f5" }),
		summary: () => "Switched to light text on a dark background.",
	},
	"large-targets": {
		css: () => `
body a, body button, body input, body select, body textarea, body [role="button"], body summary { min-height: 44px !important; }
body button, body [role="button"], body input[type="submit"], body input[type="button"], body summary {
	min-width: 44px !important;
	padding: 0.6em 1em !important;
}
body nav a, body li > a { display: inline-block !important; padding: 0.6em 0.4em !important; }
body :focus-visible { outline: 4px solid #ffbf47 !important; outline-offset: 2px !important; box-shadow: 0 0 0 6px #111111 !important; }`,
		summary: () => "Enlarged buttons and links and added a bold focus outline.",
	},
	declutter: {
		css: () => `
body [id*="google_ads" i], body [class*="advert" i], body [id*="advert" i], body [class*="adsbygoogle" i],
body [class*="ad-slot" i], body [class*="ad-container" i], body [id^="ad-" i], body [class^="ad-" i],
body [data-ad], body [data-ad-slot], body iframe[src*="doubleclick"], body iframe[src*="googlesyndication"],
body [class*="cookie" i], body [id*="cookie" i], body [class*="consent" i], body [id*="consent" i],
body [class*="newsletter" i], body [class*="popup" i], body [class*="modal" i],
body [aria-modal="true"], body [role="dialog"] { display: none !important; }
html, body { overflow: auto !important; }`,
		summary: () => "Hid ads, cookie banners, and pop-ups.",
	},
	"reduce-motion": {
		css: () => `
*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }`,
		summary: () => "Stopped animations and transitions.",
	},
};

export async function mockReformat(html, requirements, other) {
	await new Promise((resolve) => setTimeout(resolve, DELAY_MS));

	const css = [];
	const changes = [];
	for (const requirement of requirements) {
		const rule = RULES[requirement.id];
		if (rule) {
			css.push(rule.css(requirement));
			changes.push(rule.summary(requirement));
		} else {
			changes.push(`Skipped "${requirement.label}" (needs the AI server).`);
		}
	}
	if (other) changes.push("Skipped your custom request (needs the AI server).");

	const style = `<style id="reform-demo">${css.join("\n")}\n</style>`;
	const output = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => `${style}</head>`) : style + html;
	return { html: output, changes };
}
