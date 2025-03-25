// popup.js
document.getElementById("start").addEventListener("click", () => {
  console.log("Start button clicked!");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "start" }, (response) => {
      console.log("Response from content script:", response);
    });
  });
});

document.getElementById("stop").addEventListener("click", () => {
  console.log("Stop button clicked!");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "stop" }, (response) => {
      console.log("Response from content script:", response);
    });
  });
});

document.getElementById("describeImage").addEventListener("click", () => {
  console.log("Describe Current Element button clicked!");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "describeCurrentElement" },
      (response) => {
        console.log("Response from content script:", response);
      }
    );
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateElementType") {
    const elementTypeDiv = document.getElementById("elementType");
    elementTypeDiv.textContent = `Current Element: ${message.elementType}`;
  }
});

document.getElementById("language").addEventListener("change", (event) => {
  const language = event.target.value;
  console.log(`Language selected: ${language}`);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "changeLanguage", language: language },
      (response) => {
        console.log("Response from content script:", response);
      }
    );
  });
});

chrome.storage.sync.get(["language"], (result) => {
  const language = result.language || "en-US";
  document.getElementById("language").value = language;
});

// Add keydown event listener for Enter and Shift+Enter
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault(); // Prevent any default behavior
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (event.shiftKey) {
        // Shift+Enter: Move to previous element
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "movePrevious" },
          (response) => {
            console.log("Response from content script:", response);
          }
        );
      } else {
        // Enter: Move to next element
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: "moveNext" },
          (response) => {
            console.log("Response from content script:", response);
          }
        );
      }
    });
  }
});

// New: Handle API key storage
document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKeyInput");
  const saveApiKeyButton = document.getElementById("saveApiKeyButton");
  const apiKeyStatus = document.getElementById("apiKeyStatus");

  // Load saved API key from chrome.storage
  chrome.storage.local.get(["openaiApiKey"], (result) => {
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
      apiKeyStatus.textContent = "API key loaded.";
    } else {
      apiKeyStatus.textContent = "No API key saved yet.";
    }
  });

  // Save API key to chrome.storage
  saveApiKeyButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      apiKeyStatus.textContent = "Please enter a valid API key.";
      return;
    }

    chrome.storage.local.set({ openaiApiKey: apiKey }, () => {
      if (chrome.runtime.lastError) {
        apiKeyStatus.textContent =
          "Error saving API key: " + chrome.runtime.lastError.message;
      } else {
        apiKeyStatus.textContent = "API key saved successfully.";
        // Notify background.js of the API key update
        chrome.runtime.sendMessage(
          { action: "updateApiKey", apiKey: apiKey },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error notifying background.js of API key update:",
                chrome.runtime.lastError
              );
            } else {
              console.log(
                "Background script notified of API key update:",
                response
              );
            }
          }
        );
      }
    });
  });
});
