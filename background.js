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
  } else if (message.action === "simplifyHTML") {
    simplifyHTML(message.html, message.language)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error("Error:", error);
        sendResponse({ simplifiedHTML: message.html }); // Fallback to original
      });
    return true; // Indicate async response
  }
});

async function simplifyHTML(html, language) {
  try {
    const prompt =
      language === "vi-VN"
        ? `Hãy đơn giản hóa HTML này với các yêu cầu sau: 1. Giữ nguyên tất cả thẻ <canvas>, <table>, <button>, <h1>-<h6>, <p> và các hình ảnh 2. Không thêm bất kỳ ký tự hay comment nào ngoài HTML 3. Loại bỏ quảng cáo và các yếu tố không cần thiết 4. Đảm bảo không có dấu "'''" hoặc markdown trong kết quả 5. Giữ nguyên tất cả nội dung trong bảng Chỉ trả về HTML thuần túy, không có giải thích`
        : `Simplify this HTML with these requirements: 1. Preserve all <canvas>, <table>, <button>, <h1>-<h6>, <p> and images tags 2. Don't add any extra characters or comments  3. Remove ads and unnecessary elements 4. Ensure no "'''" or markdown appears in results 5. Keep all table content intact  Return only pure HTML, no explanations`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, { text: html }],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    let simplifiedHTML =
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join(" ") || html;

    // Clean any markdown artifacts
    simplifiedHTML = simplifiedHTML.replace(/```html|```/g, "").trim();

    // Verify required elements are present
    const requiredTags = ["<table", "<canvas", "<button"];
    if (!requiredTags.every((tag) => simplifiedHTML.includes(tag))) {
      return { simplifiedHTML: html }; // Fallback to original if missing critical elements
    }

    return { simplifiedHTML };
  } catch (error) {
    console.error("Error simplifying HTML:", error);
    return { simplifiedHTML: html };
  }
}
