// content.js
console.log("Screen Reader Extension: Content script loaded on this page!");

let elements = [];
let currentIndex = -1;
let isHighlighting = false;
let selectedLanguage = "en-US";

let originalHTML = null;
let isSimplified = false;

function restorePage() {
  if (originalHTML) {
    // Create a new document and write to it first
    const newDoc = document.implementation.createHTMLDocument();
    newDoc.write(originalHTML);

    // Replace the entire document
    document.documentElement.innerHTML = newDoc.documentElement.innerHTML;

    // Reinitialize any interactive elements
    const button = document.querySelector("button");
    if (button) {
      button.onclick = () =>
        alert(
          selectedLanguage === "vi-VN"
            ? "Bạn thật tuyệt vời khi đọc đến đây!"
            : "You're awesome for reading this far!"
        );
    }

    // Reinitialize chart if it exists
    const canvas = document.getElementById("myChart");
    if (canvas && typeof Chart !== "undefined") {
      new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
          labels: [
            "Thứ 2",
            "Thứ 3",
            "Thứ 4",
            "Thứ 5",
            "Thứ 6",
            "Thứ 7",
            "Chủ nhật",
          ],
          datasets: [
            {
              label: selectedLanguage === "vi-VN" ? "Điểm số" : "Scores",
              data: [12, 19, 3, 5, 2, 15, 1],
              backgroundColor: [
                "rgba(255, 99, 132, 0.7)",
                "rgba(54, 162, 235, 0.7)",
                "rgba(255, 206, 86, 0.7)",
                "rgba(75, 192, 192, 0.7)",
                "rgba(153, 102, 255, 0.7)",
                "rgba(255, 159, 64, 0.7)",
                "rgba(199, 199, 199, 0.7)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    }

    isSimplified = false;

    if (isHighlighting) {
      elements = getFocusableElements();
      currentIndex = -1;
      moveToNextElement();
    }

    const message =
      selectedLanguage === "vi-VN"
        ? "Đã khôi phục trang gốc"
        : "Original page restored";
    narrateText(message);
  }
}

async function simplifyPage() {
  try {
    const loadingMessage =
      selectedLanguage === "vi-VN"
        ? "Đang đơn giản hóa trang, vui lòng chờ..."
        : "Simplifying page, please wait...";
    narrateText(loadingMessage);

    // Save original HTML
    originalHTML = document.documentElement.outerHTML;

    // Preserve canvas states
    const canvasStates = {};
    document.querySelectorAll("canvas").forEach((canvas) => {
      canvasStates[canvas.id] = canvas.toDataURL();
    });

    const response = await chrome.runtime.sendMessage({
      action: "simplifyHTML",
      html: originalHTML,
      language: selectedLanguage,
    });

    if (response?.simplifiedHTML) {
      // Clean the HTML before writing
      let cleanHTML = response.simplifiedHTML;

      // Remove any remaining markdown artifacts
      cleanHTML = cleanHTML.replace(/```html|```/g, "");

      // Create new document
      const newDoc = document.implementation.createHTMLDocument();
      newDoc.write(cleanHTML);

      // Verify critical content exists
      const hasTable = newDoc.querySelector("table");
      const hasCanvas = newDoc.querySelector("canvas");
      const hasButton = newDoc.querySelector("button");

      if (!hasTable || !hasCanvas || !hasButton) {
        throw new Error("Critical elements missing in simplified version");
      }

      // Replace current document
      document.documentElement.innerHTML = newDoc.documentElement.innerHTML;

      // Restore canvas visuals
      Object.entries(canvasStates).forEach(([id, dataURL]) => {
        const canvas = document.getElementById(id);
        if (canvas) {
          const img = new Image();
          img.onload = () => {
            canvas.getContext("2d").drawImage(img, 0, 0);
          };
          img.src = dataURL;
        }
      });

      isSimplified = true;

      if (isHighlighting) {
        elements = getFocusableElements();
        currentIndex = -1;
        moveToNextElement();
      }

      const successMessage =
        selectedLanguage === "vi-VN"
          ? "Trang đã được đơn giản hóa"
          : "Page has been simplified";
      narrateText(successMessage);
    }
  } catch (error) {
    console.error("Error simplifying page:", error);
    const errorMessage =
      selectedLanguage === "vi-VN"
        ? "Lỗi khi đơn giản hóa trang"
        : "Error simplifying page";
    narrateText(errorMessage);

    // Restore original if simplification failed
    if (originalHTML) {
      document.documentElement.innerHTML = originalHTML;
    }
  }
}

// Helper function to load scripts
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

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
  }
  if (tagName === "canvas") {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;

    const title =
      element.closest("[aria-labelledby]")?.textContent ||
      element.closest("figure")?.querySelector("figcaption")?.textContent;

    return (
      title ||
      (selectedLanguage === "vi-VN"
        ? "Biểu đồ không có mô tả"
        : "Chart with no description")
    );
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
  if (element.tagName.toLowerCase() === "canvas") {
    // Get the most complete description available
    const description =
      element.getAttribute("aria-label") ||
      element.closest("[aria-labelledby]")?.textContent ||
      element.closest("figure")?.querySelector("figcaption")?.textContent ||
      (selectedLanguage === "vi-VN" ? "Biểu đồ" : "Chart");

    narrateText(description);
    return;
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
  } else if (message.action === "toggleSimplify") {
    console.log(`Simplify toggle: ${message.simplify}`);
    chrome.storage.sync.set({ simplify: message.simplify }, () => {
      console.log(`Saved simplify state: ${message.simplify}`);
    });

    if (message.simplify) {
      simplifyPage();
    } else {
      restorePage();
    }
    sendResponse({ status: "Simplify toggled" });
  } else if (message.action === "simplifyHTML") {
    console.log("Simplifying HTML...");
    const { html, language, chartData } = message;
    simplifyHTML(html, language, chartData)
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error("Error:", error);
        sendResponse({ simplifiedHTML: html });
      });
    return true; // Indicate async response
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
