export function initializeCommands() {
  chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-mode") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "switchMode" });
      });
    }
  });
}
