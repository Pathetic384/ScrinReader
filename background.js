// background.js
import { API_KEY } from "./keys";
console.log("Screen Reader Extension: Background script loaded!");

const GOOGLE_VISION_API_KEY = "AIzaSyBWfSb-g3oet_WDjtYCm_7lUIdEjlnAcJA"; // No longer needed, but keeping for reference
const GOOGLE_TRANSLATION_API_KEY = "AIzaSyBWfSb-g3oet_WDjtYCm_7lUIdEjlnAcJA";
let selectedLanguage = "en-US"; // Default language
let openaiApiKey = API_KEY;

// Load the API key from chrome.storage.local on startup
// chrome.storage.local.get(["openaiApiKey"], (result) => {
//   if (result.openaiApiKey) {
//     openaiApiKey = result.openaiApiKey;
//     console.log("OpenAI API key loaded from storage.");
//   } else {
//     console.log("No OpenAI API key found in storage.");
//   }
// });

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

// Function to describe a chart using extracted data
async function describeChartWithData(chartData) {
  if (!chartData || !chartData.labels || !chartData.datasets) {
    return selectedLanguage === "vi-VN"
      ? "Đây là biểu đồ. Không thể trích xuất dữ liệu chi tiết."
      : "This is a chart. Detailed data could not be extracted.";
  }

  const { type, labels, datasets } = chartData;
  let description =
    selectedLanguage === "vi-VN"
      ? `Đây là biểu đồ ${type}. `
      : `This is a ${type} chart. `;

  description +=
    selectedLanguage === "vi-VN"
      ? "Nó có các nhãn: "
      : "It has the following labels: ";
  description += labels.join(", ") + ". ";

  datasets.forEach((dataset, index) => {
    description +=
      selectedLanguage === "vi-VN"
        ? `Bộ dữ liệu ${index + 1} (${dataset.label || "không có nhãn"}): `
        : `Dataset ${index + 1} (${dataset.label || "no label"}): `;
    dataset.data.forEach((value, i) => {
      if (labels[i]) {
        description += `${labels[i]}: ${value}${
          i < dataset.data.length - 1 ? ", " : ". "
        }`;
      }
    });
  });

  return description;
}

// Function to describe a screenshot using OpenAI API
async function describeScreenshot(boundingRect, sender) {
  try {
    // Check if the API key is available
    if (!openaiApiKey) {
      console.error("No OpenAI API key available. Please set it in the popup.");
      return selectedLanguage === "vi-VN"
        ? "Không có khóa API OpenAI. Vui lòng thiết lập trong popup."
        : "No OpenAI API key available. Please set it in the popup.";
    }

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

    // Send the cropped screenshot to OpenAI API
    const requestBody = {
      model: "gpt-4o-mini", // Using gpt-4o as per previous update
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "describe this picture",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${croppedBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`, // Use the stored API key
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(
        "OpenAI API request failed:",
        response.status,
        response.statusText
      );
      const errorText = await response.text();
      console.error("OpenAI error response:", errorText);
      throw new Error("OpenAI API request failed");
    }

    const data = await response.json();
    console.log("OpenAI API response:", data);

    let description = "";
    if (
      data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content
    ) {
      description = data.choices[0].message.content;
    } else {
      console.error("No description returned from OpenAI:", data);
      description =
        selectedLanguage === "vi-VN"
          ? "Không thể mô tả khu vực này."
          : "Unable to describe this area.";
    }

    console.log("Original description (English):", description);

    // Translate the description if the selected language is Vietnamese
    const translatedDescription = await translateText(
      description,
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

function describeChartOrTable(elementType, elementData, chartData) {
  if (elementType === "Table" && elementData) {
    let description = selectedLanguage === "vi-VN" ? "Bảng: " : "Table: ";
    description += elementData.map((row) => row.join(", ")).join("; ");
    return description;
  } else if (elementType === "Canvas (Chart)" && chartData) {
    return describeChartWithData(chartData);
  }
  return selectedLanguage === "vi-VN"
    ? "Đây là biểu đồ hoặc bảng. Mô tả chi tiết chưa có sẵn."
    : "This is a chart or table. Detailed description is not yet available.";
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "describeElement") {
    const { elementType, boundingRect, elementData, chartData } = message;

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
      // If chart data is available, use it; otherwise, fall back to screenshot description
      if (elementType === "Canvas (Chart)" && chartData) {
        const description = describeChartWithData(chartData);
        clearTimeout(timeout);
        translateText(description, selectedLanguage).then(
          (translatedDescription) => {
            sendResponse({ description: translatedDescription });
          }
        );
      } else {
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
      }
    } else {
      clearTimeout(timeout);
      const description = describeChartOrTable(
        elementType,
        elementData,
        chartData
      );
      translateText(description, selectedLanguage).then(
        (translatedDescription) => {
          sendResponse({ description: translatedDescription });
        }
      );
    }

    return true; // Indicate asynchronous response
  } else if (message.action === "updateLanguage") {
    // Update the selected language when it changes in content.js
    selectedLanguage = message.language;
    console.log("Background script updated language to:", selectedLanguage);
    sendResponse({ status: "Language updated" });
  } else if (message.action === "updateApiKey") {
    // Update the API key when it changes in popup.js
    openaiApiKey = message.apiKey;
    console.log("Background script updated OpenAI API key.");
    sendResponse({ status: "API key updated" });
  } else if (message.action === "executeScript") {
    // Execute a script in the context of the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            func: message.func,
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error executing script:",
                chrome.runtime.lastError
              );
              sendResponse({ error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ data: results[0].result });
            }
          }
        );
      } else {
        sendResponse({ error: "No active tab found" });
      }
    });
    return true; // Indicate asynchronous response
  }
});
