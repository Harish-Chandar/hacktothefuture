import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({
	origin: "chrome-extension://niiogjnifajgifkhicfifjfabmconbfk"
}));
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5000);

const gemini_prompt = "You're given an HTML page and a user's request to make the page more accessible. You should return *ONLY* the new HTML source of the page, with no other text or explanation. Fix color contrasts, add alt text to images, and ensure that all interactive elements are keyboard acecssible. If the user requests, reformat the HTML to be more semantic, accessible, and 'standard'."

const API_KEY = process.env.GEMINI;

app.get("/", (_request, response) => {
	response.json({ status: "ok" });
});





app.use(express.json());

app.post("/ask-gemini", async (request, response) => {
	const prompt = request.body.prompt;

	const geminiResponse = await fetch(
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": API_KEY
			},
			body: JSON.stringify({
				contents: [
					{
						parts: [
							{
								text: prompt
							}
						]
					}
				]
			})
		}
	);

	const data = await geminiResponse.json();
	console.log(JSON.stringify(data, null, 2));
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response";

	response.json({ text });
});


app.listen(port, host, () => {
	console.log(`API listening at http://${host}:${port}`);
});