import express from "express";

const app = express();
const host = "127.0.0.1";
const port = 5000;

app.get("/", (_request, response) => {
	response.json({ status: "ok" });
});

app.listen(port, host, () => {
	console.log(`API listening at http://${host}:${port}`);
});
