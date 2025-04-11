// background.js
console.log("Screen Reader Extension: Background script loaded!");

const API_KEY = "AIzaSyAAomWzcEaQZeF4pjGViuEG9pLjYfhbOBg";
let selectedLanguage = "en-US";

async function getDevicePixelRatio() {
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

chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-mode") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "switchMode" });
    });
  }
});

async function describeScreenshot(boundingRect, sender) {
  try {
    // Capture the visible tab
    const screenshotDataUrl = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(null, { format: "jpeg" }, (dataUrl) => {
        chrome.runtime.lastError
          ? reject(chrome.runtime.lastError)
          : resolve(dataUrl);
      });
    });

    // Get the device pixel ratio
    const devicePixelRatio = await getDevicePixelRatio();

    // Send the screenshot to content.js for cropping
    const croppedBase64 = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        sender.tab.id,
        {
          action: "cropScreenshot",
          screenshotDataUrl: screenshotDataUrl,
          boundingRect: boundingRect,
          devicePixelRatio: devicePixelRatio,
        },
        (response) => {
          chrome.runtime.lastError
            ? reject(chrome.runtime.lastError)
            : resolve(response?.croppedBase64);
        }
      );
    });

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    selectedLanguage === "vi-VN"
                      ? "Hãy mô tả hình ảnh này một cách chi tiết"
                      : "Describe this image in detail",
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: croppedBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const description =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join(" ") ||
      (selectedLanguage === "vi-VN"
        ? "Không thể mô tả khu vực này."
        : "Unable to describe this area.");

    return description;
  } catch (error) {
    console.error("Error:", error);
    return selectedLanguage === "vi-VN"
      ? "Lỗi khi mô tả khu vực. Vui lòng thử lại sau."
      : "Error describing the area. Please try again later.";
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "describeElement") {
    describeScreenshot(message.boundingRect, sender)
      .then((description) => sendResponse({ description }))
      .catch((error) =>
        sendResponse({
          description:
            selectedLanguage === "vi-VN"
              ? "Lỗi: " + error.message
              : "Error: " + error.message,
        })
      );
    return true;
  } else if (message.action === "updateLanguage") {
    selectedLanguage = message.language;
    sendResponse({ status: "Language updated" });
  } else if (message.action === "summarizePage") {
    summarizePage(message.text, message.url, message.language)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error("Error:", error);
        sendResponse({ summary: message.text });
      });
    return true;
    // Add this to the message listener in background.js
  } else if (message.action === "describeArea") {
    describeScreenshot(message.boundingRect, sender)
      .then((description) => {
        // Ensure we're sending back an object with a description property
        sendResponse({ description: description });
      })
      .catch((error) => {
        console.error("Error describing area:", error);
        sendResponse({
          description:
            selectedLanguage === "vi-VN"
              ? "Lỗi: " + error.message
              : "Error: " + error.message,
        });
      });
    return true; // Important: This indicates we'll respond asynchronously
  }
});

async function summarizePage(text, url, language) {
  try {
    const prompt =
      language === "vi-VN"
        ? `Hãy tóm tắt nội dung chính của trang web này thành các điểm chính. Mỗi điểm nên là một dòng riêng biệt. Giữ lại:
         - Tiêu đề chính
         - Các mục quan trọng
         - Dữ liệu bảng (nếu có)
         - Liên kết quan trọng
         Bỏ qua quảng cáo và các yếu tố không cần thiết. Trả về kết quả dưới dạng HTML đơn giản.`
        : `Summarize the main content of this web page into key points. Each point should be a separate line. Keep:
         - Main headings
         - Important items
         - Table data (if any)
         - Important links
         Skip ads and non-essential elements. Return result as simple HTML.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { text: `Page URL: ${url}\n\nPage Content:\n${text}` },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    const summary =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join(" ") || text;

    return { summary };
  } catch (error) {
    console.error("Error summarizing page:", error);
    return { summary: text };
  }
}
