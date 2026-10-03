# Reform (Chrome extension)

The popup lets a user pick accessibility needs (contrast, text size, simpler layout, and more, plus a free-text "Anything else?"), sends the current page's HTML and those requirements to the server, and shows the rewritten page either in place (with a "Restore original page" button) or in a new tab.

## Load it in Chrome

1. Go to `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `reform/` folder.
3. Pin Reform from the puzzle-piece menu, open any website, and click the icon.
4. After changing code, click the reload icon on the Reform card, then refresh the website.

**Demo mode** (on by default, toggle under **Settings** in the popup) skips the server and applies each option with built-in CSS. Use it to demo the UI before the server is ready. Turn it off to call the real server.

## Files

| File | What it does |
|---|---|
| `popup.html` / `popup.css` / `popup.js` | The popup UI: presets, checklist, "Anything else?", output choice, status, settings |
| `requirements.js` | The list of options, presets, and the instruction text sent to the server for each |
| `background.js` | Runs each job: reads the page, calls the server (or demo mode), applies the result |
| `page-scripts.js` | Functions injected into the website: capture HTML, apply new HTML, restore original |
| `viewer.html` / `viewer.css` / `viewer.js` | The "new tab" view, which renders the result in a script-free sandbox |
| `mock.js` | Demo mode: CSS-only stand-in for the server |
| `storage.js` | Settings, saved selections, and job status in `chrome.storage` |

## Server contract

The extension calls `POST {serverUrl}/reformat` (default `http://127.0.0.1:5000/reformat`).

Request body:

```json
{
  "url": "https://example.com/page",
  "title": "Page title",
  "html": "<!DOCTYPE html>\n<html>…</html>",
  "requirements": [
    {
      "id": "contrast",
      "label": "High color contrast",
      "instruction": "Make sure every piece of text meets WCAG AA color contrast: …"
    },
    {
      "id": "min-text-size",
      "label": "Bigger text",
      "instruction": "Make sure no text is smaller than 18px. …",
      "value": 18
    }
  ],
  "other": "Make the search bar easier to find"
}
```

- `html` already has `<script>`, `<noscript>`, `<template>`, and HTML comments stripped to save tokens.
- `requirements[].instruction` is ready to drop straight into the Gemini prompt, for example as a bulleted list after the system prompt. `other` is the user's free text and may be an empty string.
- Possible ids: `contrast`, `min-text-size`, `simple-layout`, `dyslexia`, `plain-language`, `color-blind`, `dark-mode`, `large-targets`, `declutter`, `reduce-motion`.

Success response (status 200):

```json
{
  "html": "<!DOCTYPE html>\n<html>…reformatted…</html>",
  "changes": ["Raised text contrast", "Made all text at least 18px"]
}
```

`html` is required. `changes` is optional; if present, the popup lists it under "Page reformatted."

Error response (any non-2xx status):

```json
{ "error": "Message shown to the user in the popup" }
```

Notes for the server:

- Pages are large. Raise Express's body limit: `app.use(express.json({ limit: "10mb" }))`.
- No CORS setup is needed for `127.0.0.1` or `localhost`. The extension has host permission for both. A different host needs to be added to `host_permissions` in `manifest.json`.
- The extension waits up to 2 minutes for a response.
- Gemini sometimes wraps its answer in Markdown code fences. Strip a leading `` ```html `` and trailing `` ``` `` before returning `html`.
- The extension removes any `<script>` tags, inline `on*` handlers, and `javascript:` URLs from the response before showing it, so the model can't run code on the user's page.
