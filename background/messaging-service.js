import { describeImage, summarizeContent, setLanguage } from "./api-service.js";
import {
  captureVisibleTab,
  getDevicePixelRatio,
} from "./screenshot-service.js";

export function initializeMessaging() {
  chrome.runtime.onMessage.addListener(
    async (message, sender, sendResponse) => {
      try {
        switch (message.action) {
          case "describeElement":
          case "describeArea":
            await handleDescribeRequest(message, sender, sendResponse);
            break;

          case "updateLanguage":
            setLanguage(message.language);
            sendResponse({ status: "Language updated" });
            break;

          case "summarizePage":
            await handleSummarizeRequest(message, sendResponse);
            break;

          default:
            sendResponse({ error: "Unknown action" });
        }
      } catch (error) {
        console.error("Message handling error:", error);
        sendResponse({ error: error.message });
      }
      return true;
    }
  );
}

async function handleDescribeRequest(message, sender, sendResponse) {
  const devicePixelRatio = await getDevicePixelRatio();
  const screenshotDataUrl = await captureVisibleTab();

  const croppedBase64 = await new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      sender.tab.id,
      {
        action: "cropScreenshot",
        screenshotDataUrl,
        boundingRect: message.boundingRect,
        devicePixelRatio,
      },
      (response) => {
        chrome.runtime.lastError
          ? reject(chrome.runtime.lastError)
          : resolve(response?.croppedBase64);
      }
    );
  });

  const description = await describeImage(croppedBase64);
  sendResponse({ description });
}

async function handleSummarizeRequest(message, sendResponse) {
  const summary = await summarizeContent(
    message.text,
    message.url,
    message.language
  );
  sendResponse({ summary });
}
