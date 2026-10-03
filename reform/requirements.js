// Accessibility options shown in the popup. Each `instruction` is sent to the
// server and goes into the LLM prompt, so it is phrased as a direct instruction.

export const DEFAULT_MIN_TEXT_SIZE = 18;

export const REQUIREMENT_GROUPS = [
	{
		label: "Readability",
		items: [
			{
				id: "contrast",
				label: "High color contrast",
				hint: "Text clearly stands out from its background",
				instruction:
					"Make sure every piece of text meets WCAG AA color contrast: at least 4.5:1 for normal text and 3:1 for large text. Fix low-contrast links, buttons, and placeholder text too.",
			},
			{
				id: "min-text-size",
				label: "Bigger text",
				hint: "Set a minimum text size",
				hasValue: true,
				instruction:
					"Make sure no text is smaller than {value}px. Scale headings up proportionally so the hierarchy stays clear.",
			},
			{
				id: "simple-layout",
				label: "Simple, traditional layout",
				hint: "One column, top to bottom",
				instruction:
					"Rearrange the page into a simple, traditional single-column layout: header, navigation, main content, then footer. Remove multi-column grids, sidebars beside content, sticky or floating elements, and carousels. Keep all important content and links.",
			},
		],
	},
	{
		label: "Reading help",
		items: [
			{
				id: "dyslexia",
				label: "Dyslexia-friendly text",
				hint: "Clear font, extra spacing, left-aligned",
				instruction:
					"Make text dyslexia-friendly: a clear sans-serif font, line height of at least 1.5, extra letter and word spacing, left-aligned (never justified) text, and lines of about 70 characters at most. Avoid italics and all-caps for body text.",
			},
			{
				id: "plain-language",
				label: "Plain language",
				hint: "Simpler words and shorter sentences",
				instruction:
					"Rewrite the visible text in plain language at about a 6th to 8th grade reading level: short sentences, common words, and brief explanations of jargon. Do not change facts, names, numbers, prices, dates, or link destinations.",
			},
		],
	},
	{
		label: "Visual help",
		items: [
			{
				id: "color-blind",
				label: "Color-blind friendly",
				hint: "Never rely on color alone",
				instruction:
					"Make the page usable for people with color blindness: use a color-blind-safe palette and never rely on color alone to convey meaning. Underline links and add icons, text labels, or patterns wherever color carries meaning.",
			},
			{
				id: "dark-mode",
				label: "Dark mode",
				hint: "Light text on a dark background",
				instruction:
					"Switch the page to a dark theme: dark backgrounds with light text and strong contrast (at least 7:1 for body text). Do not invert images or videos.",
			},
			{
				id: "large-targets",
				label: "Bigger buttons and links",
				hint: "Easier to click and tap",
				instruction:
					"Make every interactive element (links, buttons, form fields) easy to click: touch targets of at least 44x44px, comfortable spacing between them, and a thick, clearly visible focus outline.",
			},
		],
	},
	{
		label: "Less clutter",
		items: [
			{
				id: "declutter",
				label: "Remove ads and pop-ups",
				hint: "Hide ads, banners, and overlays",
				instruction:
					"Remove ads, cookie banners, newsletter pop-ups, modals, overlays, social widgets, and other content not essential to the page. Keep the main content and primary navigation.",
			},
			{
				id: "reduce-motion",
				label: "Stop animations",
				hint: "No moving or flashing content",
				instruction:
					"Remove or stop all animations, transitions, auto-playing media, carousels, and parallax or flashing effects.",
			},
		],
	},
];

export const PRESETS = [
	{ id: "low-vision", label: "Low vision", requirements: ["contrast", "min-text-size", "simple-layout", "large-targets"] },
	{ id: "dyslexia", label: "Dyslexia", requirements: ["dyslexia", "plain-language", "declutter", "reduce-motion"] },
	{ id: "color-blind", label: "Color blindness", requirements: ["contrast", "color-blind"] },
	{ id: "older-adults", label: "Older adults", requirements: ["min-text-size", "simple-layout", "plain-language", "large-targets", "declutter"] },
];

const ALL_REQUIREMENTS = REQUIREMENT_GROUPS.flatMap((group) => group.items);

// Turns the selected checkbox ids into the objects sent to the server, in the
// order they appear in the popup.
export function buildRequirements(selectedIds, { minTextSize }) {
	return ALL_REQUIREMENTS.filter((item) => selectedIds.includes(item.id)).map((item) => {
		const requirement = { id: item.id, label: item.label, instruction: item.instruction };
		if (item.hasValue) {
			requirement.value = minTextSize;
			requirement.instruction = item.instruction.replace("{value}", minTextSize);
		}
		return requirement;
	});
}
