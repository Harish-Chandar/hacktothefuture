// Opened from the side panel when it can't get microphone access. Granting it
// here grants it to the whole extension, including the side panel.

const result = document.getElementById("result");

try {
	const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	stream.getTracks().forEach((track) => track.stop());
	result.textContent = "Microphone allowed. You can close this tab and click Speak in the Reform side panel again.";
} catch {
	result.textContent =
		"Microphone access was blocked. Click the icon at the right of the address bar to allow it, then reload this tab.";
}
