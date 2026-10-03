# Reform (Chrome extension)

Clicking the Reform icon opens a side panel next to the page (the page shrinks to make room instead of being covered). The user picks what should change (color contrast, minimum text size, traditional layout), can type anything else for the AI, and clicks **Reformat page**. The rewritten page appears either in the same tab (with a **Restore original page** button) or in a new tab.

## Load it in Chrome

1. Go to `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this `reform/` folder.
3. Pin Reform from the puzzle-piece menu, open any website, and click the icon.
4. After changing code, click the reload icon on the Reform card, then close and reopen the side panel.

Start the server first (`cd server && npm install && npm start`, with `GEMINI` set in `server/.env`). To demo without the server, turn on **Demo mode** under **Settings** in the panel. It applies each option with built-in CSS and skips the free-text request.

## Files

| File | What it does |
|---|---|
| `sidepanel.html` / `.css` / `.js` | The side panel UI: options, text box, output choice, status, settings |
| `requirements.js` | The three options and the instruction sent to Gemini for each |
| `prompt.js` | Builds the Gemini prompt and pulls the HTML out of Gemini's reply |
| `background.js` | Runs each job: reads the page, calls the server (or demo mode), applies the result |
| `page-scripts.js` | Functions injected into the website: capture HTML, apply new HTML, restore original |
| `viewer.html` / `.css` / `.js` | The "new tab" view, which renders the result in a script-free sandbox |
| `mock.js` | Demo mode: CSS-only stand-in for the server |
| `storage.js` | Settings, saved selections, and job status in `chrome.storage` |

## How it talks to the server

The extension uses the server's existing endpoint, `POST {serverUrl}/ask-gemini` (default `http://127.0.0.1:5000/ask-gemini`):

- Request: `{ "prompt": "<instructions + user's needs + page HTML>" }`. The full prompt is built in `prompt.js`.
- Response: `{ "ok": true, "text": "<Gemini's reply>" }`. The extension pulls the HTML document out of `text`, even if Gemini wrapped it in a code fence.
- Errors: `{ "ok": false, "error": "message" }` (or any non-2xx status) shows that message in the panel.

Server-side notes:

- The server's JSON body limit (currently 5 MB) must fit the whole page's HTML.
- CORS doesn't matter for the extension. It has host permissions, so the server's `cors()` origin setting doesn't block it (and unpacked extensions get a different ID on each computer anyway).
- The extension waits up to 2 minutes for a response.
- The extension strips `<script>` tags, inline `on*` handlers, and `javascript:` URLs from the result before showing it, so the model can't run code on the user's page.
