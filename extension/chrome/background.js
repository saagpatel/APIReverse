// APIspy Chrome Extension — Phase 0 skeleton
// Full webRequest capture and native messaging will be implemented in Phase 1.

console.log("APIspy: service worker loaded");

chrome.runtime.onInstalled.addListener(() => {
	console.log("APIspy: extension installed");
});
