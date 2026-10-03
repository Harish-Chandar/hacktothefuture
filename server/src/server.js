import "dotenv/config";
import express from "express";

const app = express();
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5000);

const gemini_prompt = "You're given an HTML page and a user's request to make the page more accessible. You should return *ONLY* the new HTML source of the page, with no other text or explanation. Fix color contrasts, add alt text to images, and ensure that all interactive elements are keyboard acecssible. If the user requests, reformat the HTML to be more semantic, accessible, and 'standard'."

const API_KEY = process.env.GEMINI;

app.get("/", (_request, response) => {
	response.json({ status: "ok" });
});

app.listen(port, host, () => {
	console.log(`API listening at http://${host}:${port}`);
});
