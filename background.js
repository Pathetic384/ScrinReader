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
        ? 'Hãy đơn giản hóa HTML này để dễ đọc hơn cho người khiếm thị. Giữ lại nội dung chính, hình ảnh, biểu đồ và bảng.  Mỗi phần thông tin nên nằm trên một dòng riêng. Loại bỏ quảng cáo, logo và các yếu tố không cần thiết khác.  Đảm bảo tất cả hình ảnh có style="max-width:100%;height:auto".  Giữ nguyên tất cả canvas và thêm thuộc tính data-original-src nếu có.  Chỉ trả về HTML đã được tối ưu hóa, không có markdown code blocks (```html) và không có giải thích nào khác.'
        : 'Simplify this HTML for better screen reader accessibility.  Keep main content, images, charts and tables.   Place each information piece on its own line.  Remove ads, logos and other non-essential elements.   Ensure all images have style="max-width:100%;height:auto". Preserve all canvas elements and add data-original-src attribute if available.  Return only the optimized HTML with no markdown code blocks (```html) and no other explanations.';

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

    // Remove any remaining markdown code blocks
    simplifiedHTML = simplifiedHTML.replace(/^```html|```$/g, "").trim();

    return { simplifiedHTML };
  } catch (error) {
    console.error("Error simplifying HTML:", error);
    return { simplifiedHTML: html };
  }
}
