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
document
  .getElementById("simplifyToggle")
  .addEventListener("change", (event) => {
    const simplify = event.target.checked;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "toggleSimplify", simplify },
        (response) => {
          console.log("Response from content script:", response);
        }
      );
    });
  });

// Update the storage get to include simplify state
chrome.storage.sync.get(["language", "simplify"], (result) => {
  const language = result.language || "en-US";
  document.getElementById("language").value = language;
  if (result.simplify) {
    document.getElementById("simplifyToggle").checked = result.simplify;
  }
});
document.getElementById("captureArea").addEventListener("click", () => {
  console.log("Capture Area button clicked!"); // Check if this logs
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "startAreaCapture" },
      (response) => {
        console.log("Response from content script:", response);
      }
    );
  });
});
