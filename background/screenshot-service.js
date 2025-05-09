export async function getDevicePixelRatio() {
  try {
    const activeTab = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]);
      });
    });

    const result = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => window.devicePixelRatio,
    });

    return result?.[0]?.result || 1;
  } catch (error) {
    console.error("Error getting device pixel ratio:", error);
    return 1;
  }
}

export async function captureVisibleTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: "jpeg" }, (dataUrl) => {
      chrome.runtime.lastError
        ? reject(chrome.runtime.lastError)
        : resolve(dataUrl);
    });
  });
}
