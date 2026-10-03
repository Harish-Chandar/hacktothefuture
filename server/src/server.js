import "dotenv/config";
import express from "express";

const app = express();
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 5000);

const API_KEY = process.env.GEMINI;

app.get("/", (_request, response) => {
	response.json({ status: "ok" });
});

app.listen(port, host, () => {
	console.log(`API listening at http://${host}:${port}`);
});
