// background.js
console.log("Screen Reader Extension: Background script loaded!");

const GOOGLE_VISION_API_KEY = "AIzaSyBWfSb-g3oet_WDjtYCm_7lUIdEjlnAcJA";
const GOOGLE_TRANSLATION_API_KEY = "AIzaSyBWfSb-g3oet_WDjtYCm_7lUIdEjlnAcJA"; // Same key as Vision API
let selectedLanguage = "en-US"; // Default language

// Function to get the device pixel ratio by injecting a script
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

    if (result && result[0] && result[0].result !== undefined) {
      return result[0].result || 1;
    } else {
      console.error("Failed to get device pixel ratio from script injection");
      return 1;
    }
  } catch (error) {
    console.error("Error getting device pixel ratio:", error);
    return 1;
  }
}

// Function to translate text using Google Cloud Translation API
async function translateText(text, targetLanguage) {
  if (!text || targetLanguage === "en-US") {
    return text; // No translation needed for English
  }

  try {
    const requestBody = {
      q: text,
      target: targetLanguage.split("-")[0], // 'vi' for Vietnamese
      format: "text",
    };

    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATION_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      console.error(
        "Translation API request failed:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      console.error("Translation error response:", errorText);
      throw new Error("Translation API request failed");
    }

    const data = await response.json();
    if (data.data && data.data.translations && data.data.translations[0]) {
      return data.data.translations[0].translatedText;
    } else {
      console.error("No translation returned:", data);
      return text; // Fallback to original text
    }
  } catch (error) {
    console.error("Error translating text:", error);
    return text; // Fallback to original text
  }
}

// Function to describe a screenshot using Google Cloud Vision API
async function describeScreenshot(boundingRect, sender) {
  try {
    console.log("Capturing screenshot with bounding rect:", boundingRect);

    // Capture the visible tab
    const screenshotDataUrl = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(null, { format: "jpeg" }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error capturing screenshot:",
            chrome.runtime.lastError
          );
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log("Screenshot captured, data URL length:", dataUrl.length);
          resolve(dataUrl);
        }
      });
    });

    // Get the device pixel ratio (for high-DPI screens)
    const devicePixelRatio = await getDevicePixelRatio();
    console.log("Device pixel ratio:", devicePixelRatio);

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
          if (chrome.runtime.lastError) {
            console.error(
              "Error sending message to content.js:",
              chrome.runtime.lastError
            );
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response || !response.croppedBase64) {
            console.error(
              "No cropped image received from content.js:",
              response
            );
            reject(new Error("No cropped image received"));
          } else {
            resolve(response.croppedBase64);
          }
        }
      );
    });
    console.log("Cropped screenshot to base64, length:", croppedBase64.length);

    // Send the cropped screenshot to Google Cloud Vision API
    const requestBody = {
      requests: [
        {
          image: { content: croppedBase64 },
          features: [
            { type: "LABEL_DETECTION", maxResults: 10 },
            { type: "WEB_DETECTION", maxResults: 5 },
            { type: "TEXT_DETECTION", maxResults: 10 },
          ],
        },
      ],
    };

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      console.error(
        "API request failed:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error("API request failed");
    }

    const data = await response.json();
    console.log("API response:", data);

    let description = "";
    if (data.responses && data.responses[0].labelAnnotations) {
      const labels = data.responses[0].labelAnnotations
        .map((label) => label.description)
        .join(", ");
      description += `This area contains: ${labels}. `;
    }
    if (data.responses && data.responses[0].webDetection) {
      const webEntities = data.responses[0].webDetection.webEntities
        .filter((entity) => entity.description)
        .map((entity) => entity.description)
        .join(", ");
      if (webEntities) {
        description += `Web context: ${webEntities}. `;
      }
    }
    if (data.responses && data.responses[0].textAnnotations) {
      const text = data.responses[0].textAnnotations[0].description;
      if (text) {
        description += `Text in the area: ${text}.`;
      }
    }

    const finalDescription = description || "Unable to describe this area.";
    console.log("Original description (English):", finalDescription);

    // Translate the description if the selected language is Vietnamese
    const translatedDescription = await translateText(
      finalDescription,
      selectedLanguage
    );
    console.log("Translated description:", translatedDescription);

    return translatedDescription;
  } catch (error) {
    console.error("Error describing screenshot:", error);
    return selectedLanguage === "vi-VN"
      ? "Lỗi khi mô tả khu vực. Vui lòng thử lại sau."
      : "Error describing the area. Please try again later.";
  }
}

function describeChartOrTable(elementType, elementData) {
  if (elementType === "Table" && elementData) {
    let description = selectedLanguage === "vi-VN" ? "Bảng: " : "Table: ";
    description += elementData.map((row) => row.join(", ")).join("; ");
    return description;
  }
  return selectedLanguage === "vi-VN"
    ? "Đây là biểu đồ hoặc bảng. Mô tả chi tiết chưa có sẵn."
    : "This is a chart or table. Detailed description is not yet available.";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "describeElement") {
    const { elementType, boundingRect, elementData } = message;

    // Set a timeout to ensure the response is sent within a reasonable time
    const timeout = setTimeout(() => {
      console.error("Timeout waiting for screenshot description");
      sendResponse({
        description:
          selectedLanguage === "vi-VN"
            ? "Hết thời gian: Không thể mô tả khu vực trong thời gian giới hạn."
            : "Timeout: Unable to describe the area within the time limit.",
      });
    }, 10000); // 10 seconds timeout

    if (
      ["Image", "SVG Graphic", "Canvas (Chart)", "Table"].includes(
        elementType
      ) &&
      boundingRect
    ) {
      describeScreenshot(boundingRect, sender)
        .then((description) => {
          clearTimeout(timeout);
          sendResponse({ description: description });
        })
        .catch((error) => {
          clearTimeout(timeout);
          console.error("Error in describeScreenshot:", error);
          sendResponse({
            description:
              selectedLanguage === "vi-VN"
                ? "Lỗi khi mô tả khu vực: " + error.message
                : "Error describing the area: " + error.message,
          });
        });
    } else {
      clearTimeout(timeout);
      const description = describeChartOrTable(elementType, elementData);
      sendResponse({ description: description });
    }

    return true; // Indicate asynchronous response
  } else if (message.action === "updateLanguage") {
    // Update the selected language when it changes in content.js
    selectedLanguage = message.language;
    console.log("Background script updated language to:", selectedLanguage);
    sendResponse({ status: "Language updated" });
  }
});
