const promptInput = document.getElementById("prompt");
const askButton = document.getElementById("ask");
const output = document.getElementById("output");

askButton.addEventListener("click", async () => {
    output.textContent = "Applying changes";
    console.log("here 1");

    const response = await fetch("http://127.0.0.1:5000/ask-gemini", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            prompt: promptInput.value
        })
    });
    console.log("here 2");

    const data = await response.json();
    console.log("here 3");
    output.textContent = data.text;
    console.log("here 4");
});