// APIspy Chrome Extension — Service Worker
// Captures HTTP traffic via webRequest API and streams to native host

const NATIVE_HOST = "com.apispy.host";
const FLUSH_INTERVAL_MS = 500;
const KEEPALIVE_INTERVAL_MS = 20000;

// --- State ---
let isRecording = false;
let port = null;
let requestBuffer = [];
let flushTimer = null;
let keepaliveTimer = null;

// Track request start times for duration calculation
const requestTimings = new Map();

// --- Native Messaging ---

function connectNativeHost() {
	try {
		port = chrome.runtime.connectNative(NATIVE_HOST);
		port.onMessage.addListener(handleNativeMessage);
		port.onDisconnect.addListener(handleDisconnect);
		console.log("APIspy: connected to native host");
		return true;
	} catch (e) {
		console.error("APIspy: failed to connect to native host:", e);
		return false;
	}
}

function handleNativeMessage(msg) {
	if (!msg.success && msg.error) {
		console.warn("APIspy: native host error:", msg.error);
	}
}

function handleDisconnect() {
	const error = chrome.runtime.lastError;
	console.warn(
		"APIspy: native host disconnected:",
		error?.message || "unknown",
	);
	port = null;

	// Auto-reconnect if still recording
	if (isRecording) {
		setTimeout(() => {
			if (isRecording && !port) {
				console.log("APIspy: attempting reconnect...");
				connectNativeHost();
			}
		}, 2000);
	}
}

// --- Request Capture ---

// Capture request start time
chrome.webRequest.onBeforeRequest.addListener(
	(details) => {
		if (!isRecording) return;
		requestTimings.set(details.requestId, details.timeStamp);
	},
	{ urls: ["<all_urls>"] },
);

// Capture request headers
chrome.webRequest.onSendHeaders.addListener(
	(details) => {
		if (!isRecording) return;
		const entry = requestTimings.get(details.requestId);
		if (entry !== undefined) {
			// Store headers alongside timing
			requestTimings.set(details.requestId, {
				startTime: typeof entry === "number" ? entry : entry.startTime,
				requestHeaders: headersToObject(details.requestHeaders || []),
			});
		}
	},
	{ urls: ["<all_urls>"] },
	["requestHeaders"],
);

// Capture completed requests
chrome.webRequest.onCompleted.addListener(
	(details) => {
		if (!isRecording) return;

		// Skip extension internal requests
		if (
			details.url.startsWith("chrome-extension://") ||
			details.url.startsWith("chrome://")
		) {
			return;
		}

		const timing = requestTimings.get(details.requestId);
		requestTimings.delete(details.requestId);

		let durationMs = null;
		let reqHeaders = null;

		if (timing) {
			const startTime = typeof timing === "number" ? timing : timing.startTime;
			durationMs = Math.round(details.timeStamp - startTime);
			if (typeof timing === "object" && timing.requestHeaders) {
				reqHeaders = timing.requestHeaders;
			}
		}

		const request = {
			method: details.method,
			url: details.url,
			requestHeaders: reqHeaders,
			responseStatus: details.statusCode,
			responseHeaders: headersToObject(details.responseHeaders || []),
			durationMs: durationMs,
		};

		requestBuffer.push(request);
	},
	{ urls: ["<all_urls>"] },
	["responseHeaders"],
);

// Also capture errored requests (network failures, aborts)
chrome.webRequest.onErrorOccurred.addListener(
	(details) => {
		if (!isRecording) return;
		requestTimings.delete(details.requestId);
	},
	{ urls: ["<all_urls>"] },
);

// --- Buffer Flush ---

function flushBuffer() {
	if (requestBuffer.length === 0 || !port) return;

	const batch = requestBuffer.splice(0);
	for (const req of batch) {
		try {
			port.postMessage(req);
		} catch (e) {
			console.error("APIspy: postMessage failed:", e);
			// Re-queue failed messages
			requestBuffer.unshift(req);
			break;
		}
	}
}

// --- Keepalive ---

function keepalive() {
	// Prevent MV3 service worker from terminating during recording
	chrome.runtime.getPlatformInfo(() => {});
}

// --- Recording Control ---

function startRecording() {
	if (isRecording) return;

	if (!connectNativeHost()) {
		console.error("APIspy: cannot start recording — native host unavailable");
		return;
	}

	isRecording = true;
	requestBuffer = [];
	requestTimings.clear();
	flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
	keepaliveTimer = setInterval(keepalive, KEEPALIVE_INTERVAL_MS);

	chrome.action.setBadgeText({ text: "REC" });
	chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
	console.log("APIspy: recording started");
}

function stopRecording() {
	if (!isRecording) return;

	isRecording = false;

	// Final flush
	flushBuffer();

	if (flushTimer) {
		clearInterval(flushTimer);
		flushTimer = null;
	}
	if (keepaliveTimer) {
		clearInterval(keepaliveTimer);
		keepaliveTimer = null;
	}
	if (port) {
		port.disconnect();
		port = null;
	}

	requestTimings.clear();
	chrome.action.setBadgeText({ text: "" });
	console.log("APIspy: recording stopped");
}

// --- Message Handling (from popup or Tauri app) ---

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
	if (msg.action === "start") {
		startRecording();
		sendResponse({ status: "recording" });
	} else if (msg.action === "stop") {
		stopRecording();
		sendResponse({ status: "idle" });
	} else if (msg.action === "status") {
		sendResponse({
			status: isRecording ? "recording" : "idle",
			buffered: requestBuffer.length,
		});
	}
	return true;
});

// --- Helpers ---

function headersToObject(headers) {
	const obj = {};
	for (const h of headers) {
		obj[h.name] = h.value;
	}
	return obj;
}

// --- Init ---

console.log("APIspy: service worker loaded");

chrome.runtime.onInstalled.addListener(() => {
	console.log("APIspy: extension installed");
});
