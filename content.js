// content.js
console.log("Screen Reader Extension: Content script loaded on this page!");

let elements = [];
let currentIndex = -1;
let isHighlighting = false;
let selectedLanguage = "en-US";

function getFocusableElements() {
  const selectors = [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "a",
    "button",
    "input",
    "textarea",
    "select",
    "img",
    "svg",
    "canvas",
    "table",
  ];
  const query = selectors.join(", ");
  return Array.from(document.querySelectorAll(query)).filter(
    (el) =>
      el.offsetParent !== null && window.getComputedStyle(el).display !== "none"
  );
}

function highlightElement(element) {
  elements.forEach((el) => {
    el.style.outline = "";
    el.style.position = "";
    el.style.minWidth = "";
    el.style.minHeight = "";
  });

  if (element) {
    element.style.outline = "3px solid yellow";
    element.style.position = "relative";
    element.style.minWidth = "50px";
    element.style.minHeight = "20px";
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function getElementType(element) {
  const tagName = element.tagName.toLowerCase();
  switch (tagName) {
    case "p":
      return "Paragraph";
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "Heading";
    case "li":
      return "List Item";
    case "a":
      return "Link";
    case "button":
      return "Button";
    case "input":
      return "Input Field";
    case "textarea":
      return "Text Area";
    case "select":
      return "Dropdown";
    case "img":
      return "Image";
    case "svg":
      return "SVG Graphic";
    case "canvas":
      return "Canvas (Chart)";
    case "table":
      return "Table";
    default:
      return "Element";
  }
}

function getNarrationContent(element) {
  const tagName = element.tagName.toLowerCase();
  const labels = {
    "en-US": {
      image: "Image",
      noDescription: "with no description",
      chart: "Chart or graphic element",
      empty: "empty",
      link: "Link",
      noText: "no text",
    },
    "vi-VN": {
      image: "Hình ảnh",
      noDescription: "không có mô tả",
      chart: "Biểu đồ hoặc phần tử đồ họa",
      empty: "trống",
      link: "Liên kết",
      noText: "không có văn bản",
    },
  };

  const langLabels = labels[selectedLanguage] || labels["en-US"];

  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return `${getElementType(element)}: ${element.value || langLabels.empty}`;
  } else if (tagName === "a") {
    return `${langLabels.link}: ${element.textContent || langLabels.noText}`;
  } else {
    return element.textContent.trim() || "No readable content";
  }
}

function narrateText(content) {
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(content);
  utterance.lang = selectedLanguage;
  utterance.rate = 1.0;
  utterance.volume = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang === selectedLanguage) ||
    voices.find((v) => v.lang.includes(selectedLanguage.split("-")[0]));
  if (voice) {
    utterance.voice = voice;
  } else {
    console.log(`No ${selectedLanguage} voice available. Using default voice.`);
    if (selectedLanguage === "vi-VN") {
      const warning = new SpeechSynthesisUtterance(
        selectedLanguage === "vi-VN"
          ? "Không tìm thấy giọng tiếng Việt. Vui lòng cài đặt giọng tiếng Việt trên hệ thống của bạn."
          : "No Vietnamese voice found. Please install a Vietnamese voice on your system."
      );
      warning.lang = "en-US";
      window.speechSynthesis.speak(warning);
    }
  }

  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 100);
}

// Function to crop a screenshot in the content script
// Function to crop a screenshot in the content script
function cropScreenshot(screenshotDataUrl, boundingRect, devicePixelRatio) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = screenshotDataUrl;

    img.onload = () => {
      console.log("Screenshot dimensions:", {
        width: img.width,
        height: img.height,
      });
      console.log("Bounding rect before scaling:", boundingRect);
      console.log("Device pixel ratio:", devicePixelRatio);

      let x = boundingRect.x * devicePixelRatio;
      let y = boundingRect.y * devicePixelRatio;
      let width = boundingRect.width * devicePixelRatio;
      let height = boundingRect.height * devicePixelRatio;

      console.log("Crop coordinates after scaling (before clamping):", {
        x,
        y,
        width,
        height,
      });

      // Ensure minimum size for cropping
      width = Math.max(width, 10);
      height = Math.max(height, 10);

      // Clamp coordinates to stay within image bounds
      x = Math.max(0, Math.min(x, img.width - width));
      y = Math.max(0, Math.min(y, img.height - height));
      width = Math.min(width, img.width - x);
      height = Math.min(height, img.height - y);

      console.log("Crop coordinates after clamping:", { x, y, width, height });

      if (width <= 0 || height <= 0) {
        console.error("Invalid crop dimensions after clamping:", {
          width,
          height,
        });
        reject(new Error("Invalid crop dimensions after clamping"));
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      const croppedBase64 = canvas.toDataURL("image/jpeg").split(",")[1];
      resolve(croppedBase64);
    };

    img.onerror = () => {
      console.error("Failed to load screenshot image for cropping");
      reject(new Error("Failed to load screenshot image"));
    };
  });
}

function describeAndNarrateElement(element) {
  const elementType = getElementType(element);
  let elementData = null;

  if (element.tagName.toLowerCase() === "table") {
    elementData = Array.from(element.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) =>
        cell.textContent.trim()
      )
    );
  }

  // Ensure the element is in view
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  // Add a small delay to ensure the scroll is complete
  setTimeout(() => {
    const rect = element.getBoundingClientRect();
    const boundingRect = {
      x: rect.left, // Relative to the viewport, not the document
      y: rect.top, // Relative to the viewport, not the document
      width: rect.width,
      height: rect.height,
    };
    console.log(
      "Element bounding rectangle (viewport relative):",
      boundingRect
    );

    const loadingMessage =
      selectedLanguage === "vi-VN"
        ? "Đang tải mô tả, vui lòng chờ..."
        : "Loading description, please wait...";
    narrateText(loadingMessage);

    chrome.runtime.sendMessage(
      {
        action: "describeElement",
        elementType: elementType,
        boundingRect: boundingRect,
        elementData: elementData,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error sending message to background.js:",
            chrome.runtime.lastError
          );
          const errorMessage =
            selectedLanguage === "vi-VN"
              ? "Lỗi khi lấy mô tả. Vui lòng thử lại."
              : "Error retrieving description. Please try again.";
          narrateText(errorMessage);
          return;
        }

        if (!response) {
          console.error("No response received from background.js");
          const errorMessage =
            selectedLanguage === "vi-VN"
              ? "Không nhận được phản hồi từ mô tả. Vui lòng thử lại."
              : "No response received for description. Please try again.";
          narrateText(errorMessage);
          return;
        }

        console.log("Received response from background.js:", response);
        const description =
          response.description || "Unable to describe this element.";
        narrateText(description);
      }
    );
  }, 500); // 500ms delay to ensure scroll is complete
}

function narrateElement(element) {
  if (!element) return;

  const elementType = getElementType(element);
  chrome.runtime.sendMessage({
    action: "updateElementType",
    elementType: elementType,
  });

  if (
    ["Image", "SVG Graphic", "Canvas (Chart)", "Table"].includes(elementType)
  ) {
    describeAndNarrateElement(element);
  } else {
    const content = getNarrationContent(element);
    if (content !== "No readable content") {
      narrateText(content);
    }
  }
}

function describeCurrentElement() {
  if (!isHighlighting || !elements[currentIndex]) {
    const message =
      selectedLanguage === "vi-VN"
        ? "Không có phần tử nào được chọn để mô tả."
        : "No element selected to describe.";
    narrateText(message);
    return;
  }

  describeAndNarrateElement(elements[currentIndex]);
}

function moveToNextElement() {
  if (!isHighlighting || elements.length === 0) return;

  do {
    currentIndex = (currentIndex + 1) % elements.length;
    const currentElement = elements[currentIndex];
    highlightElement(currentElement);
    const content = getNarrationContent(currentElement);
    if (
      content !== "No readable content" ||
      ["Image", "SVG Graphic", "Canvas (Chart)", "Table"].includes(
        getElementType(currentElement)
      )
    ) {
      narrateElement(currentElement);
      break;
    }
  } while (true);
}

function moveToPreviousElement() {
  if (!isHighlighting || elements.length === 0) return;

  do {
    currentIndex = (currentIndex - 1 + elements.length) % elements.length;
    const currentElement = elements[currentIndex];
    highlightElement(currentElement);
    const content = getNarrationContent(currentElement);
    if (
      content !== "No readable content" ||
      ["Image", "SVG Graphic", "Canvas (Chart)", "Table"].includes(
        getElementType(currentElement)
      )
    ) {
      narrateElement(currentElement);
      break;
    }
  } while (true);
}

function startHighlighting() {
  if (isHighlighting) return;

  elements = getFocusableElements();
  if (elements.length === 0) {
    console.log("No focusable elements found on this page.");
    return;
  }

  isHighlighting = true;
  currentIndex = -1;
  moveToNextElement();
}

function stopHighlighting() {
  isHighlighting = false;
  currentIndex = -1;
  highlightElement(null);
  elements = [];
  window.speechSynthesis.cancel();
  chrome.runtime.sendMessage({
    action: "updateElementType",
    elementType: "None",
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "start") {
    console.log("Starting highlighting...");
    startHighlighting();
    sendResponse({ status: "Highlighting started" });
  } else if (message.action === "stop") {
    console.log("Stopping highlighting...");
    stopHighlighting();
    sendResponse({ status: "Highlighting stopped" });
  } else if (message.action === "changeLanguage") {
    console.log(`Changing language to ${message.language}`);
    selectedLanguage = message.language;
    chrome.storage.sync.set({ language: selectedLanguage }, () => {
      console.log(`Saved language: ${selectedLanguage}`);
    });
    // Notify background.js of the language change
    chrome.runtime.sendMessage(
      { action: "updateLanguage", language: selectedLanguage },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error notifying background.js of language change:",
            chrome.runtime.lastError
          );
        } else {
          console.log(
            "Background script notified of language change:",
            response
          );
        }
      }
    );
    if (isHighlighting && elements[currentIndex]) {
      narrateElement(elements[currentIndex]);
    }
    sendResponse({ status: "Language changed" });
  } else if (message.action === "describeCurrentElement") {
    console.log("Describing current element...");
    describeCurrentElement();
    sendResponse({ status: "Description requested" });
  } else if (message.action === "moveNext") {
    console.log("Moving to next element...");
    moveToNextElement();
    sendResponse({ status: "Moved to next element" });
  } else if (message.action === "movePrevious") {
    console.log("Moving to previous element...");
    moveToPreviousElement();
    sendResponse({ status: "Moved to previous element" });
  } else if (message.action === "cropScreenshot") {
    console.log("Cropping screenshot...");
    const { screenshotDataUrl, boundingRect, devicePixelRatio } = message;
    cropScreenshot(screenshotDataUrl, boundingRect, devicePixelRatio)
      .then((croppedBase64) => {
        sendResponse({ croppedBase64: croppedBase64 });
      })
      .catch((error) => {
        console.error("Error cropping screenshot:", error);
        sendResponse({ error: error.message });
      });
    return true; // Indicate asynchronous response
  }
});

const observer = new MutationObserver(() => {
  if (isHighlighting) {
    elements = getFocusableElements();
    if (elements.length === 0) {
      stopHighlighting();
      return;
    }
    if (currentIndex >= elements.length || !elements[currentIndex]) {
      currentIndex = Math.min(currentIndex, elements.length - 1);
      if (currentIndex < 0) currentIndex = 0;
    }
    highlightElement(elements[currentIndex]);
    narrateElement(elements[currentIndex]);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Also send the initial language to background.js when content.js loads
chrome.storage.sync.get(["language"], (result) => {
  if (result.language) {
    selectedLanguage = result.language;
    console.log(`Loaded saved language: ${selectedLanguage}`);
    // Notify background.js of the initial language
    chrome.runtime.sendMessage(
      { action: "updateLanguage", language: selectedLanguage },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error notifying background.js of initial language:",
            chrome.runtime.lastError
          );
        } else {
          console.log(
            "Background script notified of initial language:",
            response
          );
        }
      }
    );
  }
});

window.speechSynthesis.onvoiceschanged = () => {
  console.log("Voices loaded:", window.speechSynthesis.getVoices());
};
