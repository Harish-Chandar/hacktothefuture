// Accessibility options shown in the side panel. Each `instruction` goes into
// the Gemini prompt, so it is phrased as a direct instruction.

export const DEFAULT_MIN_TEXT_SIZE = 18;

export const REQUIREMENTS = [
	{
		id: "contrast",
		label: "Color contrast",
		hint: "Make text stand out from its background",
		instruction:
			"Make sure every piece of text meets WCAG AA color contrast: at least 4.5:1 for normal text and 3:1 for large text. Fix low-contrast links, buttons, and placeholder text too.",
	},
	{
		id: "min-text-size",
		label: "Minimum text size",
		hint: "No text smaller than the size you choose",
		hasValue: true,
		instruction:
			"Make sure no text is smaller than {value}px. Scale headings up proportionally so the hierarchy stays clear.",
	},
	{
		id: "simple-layout",
		label: "Traditional layout",
		hint: "One simple column, top to bottom",
		instruction:
			"Rearrange the page into a simple, traditional single-column layout: header, navigation, main content, then footer. Remove multi-column grids, sidebars beside content, sticky or floating elements, and carousels. Keep all important content and links.",
	},
];

// Turns the selected checkbox ids into the requirement objects used for the
// prompt, in the order they appear in the panel.
export function buildRequirements(selectedIds, { minTextSize }) {
	return REQUIREMENTS.filter((item) => selectedIds.includes(item.id)).map((item) => {
		const requirement = { id: item.id, label: item.label, instruction: item.instruction };
		if (item.hasValue) {
			requirement.value = minTextSize;
			requirement.instruction = item.instruction.replace("{value}", minTextSize);
		}
		return requirement;
	});
}
