import { narrateText } from "./speech-service.js";
import { initializeNormalMode } from "./navigation-service.js";

let currentMode = "normal";

export function initializeModes() {
  document.addEventListener("keydown", handleKeyDown);
}

export function switchMode() {
  const modes = ["normal", "capture", "simplify", "language"];
  const currentIndex = modes.indexOf(currentMode);
  currentMode = modes[(currentIndex + 1) % modes.length];

  const modeMessages = {
    normal: {
      "en-US": "Normal mode. Ctrl to next, Ctrl+Shift to previous.",
      "vi-VN": "Chế độ bình thường. Ctrl để tới, Ctrl+Shift để lùi.",
    },
    capture: {
      "en-US": "Capture mode. Ctrl to start, Ctrl+Shift to cancel.",
      "vi-VN": "Chế độ chụp. Ctrl để bắt đầu, Ctrl+Shift để hủy.",
    },
    simplify: {
      "en-US": "Simplify mode. Ctrl to toggle simplification.",
      "vi-VN": "Chế độ đơn giản. Ctrl để bật/tắt.",
    },
    language: {
      "en-US": "Language mode. Ctrl to switch languages.",
      "vi-VN": "Chế độ ngôn ngữ. Ctrl để đổi ngôn ngữ.",
    },
  };

  narrateText(modeMessages[currentMode][selectedLanguage]);

  if (currentMode === "normal") {
    initializeNormalMode();
  }
}

function handleKeyDown(e) {
  if (e.key === "Escape") {
    e.preventDefault();
    switchMode();
    return;
  }

  if (e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();

    switch (currentMode) {
      case "normal":
        if (e.shiftKey) moveToPreviousElement();
        else moveToNextElement();
        break;

      case "capture":
        if (e.shiftKey) cancelAreaCapture();
        else startAreaCapture();
        break;

      case "language":
        if (!e.shiftKey) toggleLanguage();
        break;

      case "simplify":
        if (!e.shiftKey) toggleSimplify();
        break;
    }
  }
}

function toggleLanguage() {
  selectedLanguage = selectedLanguage === "en-US" ? "vi-VN" : "en-US";
  chrome.storage.sync.set({ language: selectedLanguage });
  chrome.runtime.sendMessage({
    action: "changeLanguage",
    language: selectedLanguage,
  });

  const message =
    selectedLanguage === "vi-VN"
      ? "Đã chuyển sang tiếng Việt"
      : "Switched to English";
  narrateText(message);
}

function toggleSimplify() {
  const simplify = !isSimplified;
  chrome.storage.sync.set({ simplify }, () => {
    console.log(`Saved simplify state: ${simplify}`);
  });

  if (simplify) simplifyPage();
  else restorePage();
}

export function getCurrentMode() {
  return currentMode;
}
