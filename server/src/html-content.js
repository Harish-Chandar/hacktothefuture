import { load } from "cheerio";

const CONTENT_ELEMENTS = "h1, h2, h3, h4, h5, h6, p, blockquote, li, table";
const REMOVED_ELEMENTS = "head, script, style, noscript, template, svg, canvas, iframe, object, embed";

function readableText($, element) {
	const clone = $(element).clone();

	clone.find("a").each((_index, link) => {
		const linkElement = $(link);
		const label = linkElement.text().replace(/\s+/g, " ").trim();
		const href = linkElement.attr("href");
		linkElement.replaceWith(
			href ? `${label || href} (${href})` : label
		);
	});

	return clone.text().replace(/\s+/g, " ").trim();
}

export function extractReadableContent(html) {
	const $ = load(html, { decodeEntities: true });
	const root = $("body").length ? $("body") : $.root();
	root.find(REMOVED_ELEMENTS).remove();

	const sections = [];

	root.find(CONTENT_ELEMENTS).each((_index, element) => {
		const current = $(element);
		const tagName = element.name;

		if (current.parents("table").length || current.parents("li").length) {
			return;
		}

		if (tagName === "table") {
			const rows = [];
			current.find("tr").each((_rowIndex, row) => {
				const cells = [];
				$(row).find("th, td").each((_cellIndex, cell) => {
					cells.push(readableText($, cell));
				});
				if (cells.some(Boolean)) rows.push(cells.join(" | "));
			});

			if (rows.length) sections.push(`Table:\n${rows.join("\n")}`);
			return;
		}

		const text = readableText($, element);
		if (!text) return;

		const prefix = tagName === "li" ? "- " : `${tagName.toUpperCase()}: `;
		sections.push(`${prefix}${text}`);
	});

	return sections.join("\n\n").slice(0, 20000);
}
