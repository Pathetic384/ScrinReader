import {
  startHighlighting,
  stopHighlighting,
  moveToNextElement,
  moveToPreviousElement,
  describeAndNarrateElement,
} from "./navigation-service.js";
import { setLanguage } from "./speech-service.js";
import { startAreaCapture, cropScreenshot } from "./capture-service.js";
import { simplifyPage, restorePage } from "./simplify-service.js";
import { switchMode } from "./mode-service.js";

export function initializeMessaging() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case "start":
        startHighlighting();
        sendResponse({ status: "Highlighting started" });
        break;

      case "stop":
        stopHighlighting();
        sendResponse({ status: "Highlighting stopped" });
        break;

      case "changeLanguage":
        setLanguage(message.language);
        sendResponse({ status: "Language changed" });
        break;

      case "describeCurrentElement":
        describeCurrentElement();
        sendResponse({ status: "Description requested" });
        break;

      case "moveNext":
        moveToNextElement();
        sendResponse({ status: "Moved to next element" });
        break;

      case "movePrevious":
        moveToPreviousElement();
        sendResponse({ status: "Moved to previous element" });
        break;

      case "cropScreenshot":
        cropScreenshot(
          message.screenshotDataUrl,
          message.boundingRect,
          message.devicePixelRatio
        )
          .then((croppedBase64) => sendResponse({ croppedBase64 }))
          .catch((error) => sendResponse({ error: error.message }));
        return true;

      case "toggleSimplify":
        if (message.simplify) simplifyPage();
        else restorePage();
        sendResponse({ status: "Simplify toggled" });
        break;

      case "startAreaCapture":
        startAreaCapture();
        sendResponse({ status: "Area capture started" });
        break;

      case "switchMode":
        switchMode();
        sendResponse({ status: "Mode switched" });
        break;

      default:
        sendResponse({ error: "Unknown action" });
    }
  });
}

function describeCurrentElement() {
  if (getCurrentMode() !== "normal") return;

  if (!elements.length) {
    elements = getFocusableElements();
    if (!elements.length) {
      const message =
        selectedLanguage === "vi-VN"
          ? "Không tìm thấy phần tử nào để mô tả"
          : "No elements found to describe";
      narrateText(message);
      return;
    }
    currentIndex = 0;
    highlightElement(elements[currentIndex]);
  }

  if (currentIndex >= 0 && currentIndex < elements.length) {
    describeAndNarrateElement(elements[currentIndex]);
  } else {
    const message =
      selectedLanguage === "vi-VN"
        ? "Không có phần tử nào được chọn để mô tả. Hãy điều hướng trước."
        : "No element selected to describe. Please navigate first.";
    narrateText(message);
  }
}
