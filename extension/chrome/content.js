// APIspy Content Script — Request/Response Body Capture
// Injected into pages when body capture is enabled.
// Monkey-patches fetch() and XMLHttpRequest to intercept bodies.

let bodyCaptureEnabled = false;

// Listen for activation from background script
chrome.runtime.onMessage.addListener((msg) => {
	if (msg.type === "enableBodyCapture") {
		bodyCaptureEnabled = true;
		patchFetch();
		patchXHR();
		console.log("APIspy: body capture enabled");
	} else if (msg.type === "disableBodyCapture") {
		bodyCaptureEnabled = false;
		console.log("APIspy: body capture disabled");
	}
});

// --- Fetch Monkey-Patch ---

let fetchPatched = false;

function patchFetch() {
	if (fetchPatched) return;
	fetchPatched = true;

	const originalFetch = window.fetch;

	window.fetch = async function patchedFetch(input, init) {
		if (!bodyCaptureEnabled) {
			return originalFetch.call(this, input, init);
		}

		let requestUrl = "";
		let requestBody = null;

		try {
			if (typeof input === "string") {
				requestUrl = input;
			} else if (input instanceof URL) {
				requestUrl = input.toString();
			} else if (input instanceof Request) {
				requestUrl = input.url;
			}

			if (init?.body) {
				if (typeof init.body === "string") {
					requestBody = init.body;
				} else if (init.body instanceof URLSearchParams) {
					requestBody = init.body.toString();
				} else if (init.body instanceof FormData) {
					requestBody = "[FormData]";
				}
			}
		} catch {
			// Ignore errors in body extraction
		}

		try {
			const response = await originalFetch.call(this, input, init);

			// Clone response to read body without consuming it
			const clone = response.clone();
			clone
				.text()
				.then((responseBody) => {
					sendBodyToBackground(requestUrl, requestBody, responseBody);
				})
				.catch(() => {});

			return response;
		} catch (err) {
			throw err;
		}
	};
}

// --- XMLHttpRequest Monkey-Patch ---

let xhrPatched = false;

function patchXHR() {
	if (xhrPatched) return;
	xhrPatched = true;

	const originalOpen = XMLHttpRequest.prototype.open;
	const originalSend = XMLHttpRequest.prototype.send;

	XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...args) {
		this._apispy_url = typeof url === "string" ? url : url.toString();
		return originalOpen.apply(this, [method, url, ...args]);
	};

	XMLHttpRequest.prototype.send = function patchedSend(body) {
		if (!bodyCaptureEnabled) {
			return originalSend.call(this, body);
		}

		const requestBody =
			body != null ? (typeof body === "string" ? body : "[binary]") : null;
		const url = this._apispy_url || "";

		this.addEventListener("load", function onLoad() {
			try {
				const responseBody = this.responseText;
				sendBodyToBackground(url, requestBody, responseBody);
			} catch {
				// Ignore
			}
		});

		return originalSend.call(this, body);
	};
}

// --- Send to Background ---

function sendBodyToBackground(url, requestBody, responseBody) {
	try {
		// Truncate large bodies
		const maxSize = 50000;
		const truncatedReqBody =
			requestBody && requestBody.length > maxSize
				? requestBody.slice(0, maxSize)
				: requestBody;
		const truncatedResBody =
			responseBody && responseBody.length > maxSize
				? responseBody.slice(0, maxSize)
				: responseBody;

		chrome.runtime.sendMessage({
			type: "bodyCapture",
			url: url,
			requestBody: truncatedReqBody,
			responseBody: truncatedResBody,
			timestamp: Date.now(),
		});
	} catch {
		// Extension context may be invalidated
	}
}
