const promptInput = document.getElementById("prompt");
const askButton = document.getElementById("ask");
const output = document.getElementById("output");

askButton.addEventListener("click", async () => {
    output.textContent = "Applying changes";

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
        output.textContent = "Open a normal webpage first.";
        return;
    }

    const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.documentElement.outerHTML
    });

    const pageHtml = result.result;

    const response = await fetch("http://127.0.0.1:5000/ask-gemini", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: `
User request:
${promptInput.value}

Page HTML:
${pageHtml}
`
        })
    });

    const data = await response.json();

    if (!data.ok) {
        output.textContent = data.error || "Gemini did not return HTML.";
        return;
    }

    if (!data.text) {
        output.textContent = "Gemini returned an empty page.";
        return;
    }

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        args: [data.text],
        func: (newHtml) => {
            document.open();
            document.write(newHtml);
            document.close();
        }
    });

    output.textContent = "Updated page.";
});
