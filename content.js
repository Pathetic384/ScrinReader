// content.js
console.log("Screen Reader Extension: Content script loaded on this page!");

// Add these at the top with other variables
let currentMode = "normal"; // 'normal', 'capture', 'simplify', 'language'
let isNavigating = false;
let elements = [];
let currentIndex = -1;
let isHighlighting = false;
let selectedLanguage = "en-US";

let originalHTML = null;
let isSimplified = false;

function switchMode() {
  const modes = ["normal", "capture", "simplify", "language"];
  const currentIndex = modes.indexOf(currentMode);
  currentMode = modes[(currentIndex + 1) % modes.length];

  // Stop any current highlighting when switching modes
  stopHighlighting();

  const modeMessages = {
    normal: {
      "en-US":
        "Normal mode. Use Ctrl+Arrow keys to navigate. Ctrl+Enter to describe.",
      "vi-VN":
        "Chế độ bình thường. Dùng Ctrl+Mũi tên để điều hướng. Ctrl+Enter để mô tả.",
    },
    capture: {
      "en-US": "Capture mode. Press Ctrl+Enter to start area selection.",
      "vi-VN": "Chế độ chụp. Nhấn Ctrl+Enter để bắt đầu chọn vùng.",
    },
    simplify: {
      "en-US": "Simplify mode. Press Ctrl+Enter to toggle simplified view.",
      "vi-VN": "Chế độ đơn giản. Nhấn Ctrl+Enter để bật/tắt chế độ đơn giản.",
    },
    language: {
      "en-US": "Language mode. Press Ctrl+Enter to switch languages.",
      "vi-VN": "Chế độ ngôn ngữ. Nhấn Ctrl+Enter để đổi ngôn ngữ.",
    },
  };

  // Announce the new mode
  narrateText(modeMessages[currentMode][selectedLanguage]);

  // Special handling when entering normal mode
  if (currentMode === "normal") {
    elements = getFocusableElements();
    if (elements.length > 0) {
      currentIndex = 0;
      highlightElement(elements[currentIndex]);
      narrateElement(elements[currentIndex]);

      // Additional explanation for normal mode
      const helpMessage =
        selectedLanguage === "vi-VN"
          ? "Đang chọn phần tử đầu tiên. Dùng Ctrl+Mũi tên trái/phải để điều hướng."
          : "First element selected. Use Ctrl+Left/Right arrows to navigate.";
      setTimeout(() => narrateText(helpMessage), 1000);
    } else {
      const message =
        selectedLanguage === "vi-VN"
          ? "Không tìm thấy phần tử nào để điều hướng"
          : "No elements found to navigate";
      narrateText(message);
    }
  }
}

// Add this keydown listener to the document
document.addEventListener("keydown", (e) => {
  // ESC to switch modes
  if (e.key === "Escape") {
    e.preventDefault();
    switchMode();
    return;
  }

  // Handle mode-specific shortcuts
  if (e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();

    switch (currentMode) {
      case "normal":
        if (e.key === "ArrowRight") {
          if (!elements.length) {
            elements = getFocusableElements();
            if (elements.length) {
              const message =
                selectedLanguage === "vi-VN"
                  ? "Đã tìm thấy các phần tử để điều hướng"
                  : "Found elements to navigate";
              narrateText(message);
            }
            currentIndex = -1;
          }
          moveToNextElement();
        } else if (e.key === "ArrowLeft") {
          if (!elements.length) {
            elements = getFocusableElements();
            if (elements.length) {
              const message =
                selectedLanguage === "vi-VN"
                  ? "Đã tìm thấy các phần tử để điều hướng"
                  : "Found elements to navigate";
              narrateText(message);
            }
            currentIndex = elements.length;
          }
          moveToPreviousElement();
        } else if (e.key === "Enter") {
          describeCurrentElement();
        }
        break;

      case "capture":
        if (e.key === "Enter") {
          startAreaCapture();
        }
        break;

      case "simplify":
        if (e.key === "Enter") {
          toggleSimplify();
        }
        break;

      case "language":
        if (e.key === "Enter") {
          toggleLanguage();
        }
        break;
    }
  }
});

// Add these helper functions
function startAreaCapture() {
  isAreaCaptureMode = true;
  createCaptureOverlay();
  const message =
    selectedLanguage === "vi-VN"
      ? "Chế độ chụp ảnh đã bật. Kéo để chọn vùng bạn muốn mô tả. Nhấn ESC để hủy."
      : "Area capture mode enabled. Drag to select the area you want to describe. Press ESC to cancel.";
  narrateText(message);
}

async function toggleSimplify() {
  const simplify = !isSimplified;
  if (simplify) {
    await simplifyPage();
  } else {
    restorePage();
  }
  const message =
    selectedLanguage === "vi-VN"
      ? `Trang đã được ${simplify ? "đơn giản hóa" : "khôi phục"}`
      : `Page has been ${simplify ? "simplified" : "restored"}`;
  narrateText(message);
}

function toggleLanguage() {
  selectedLanguage = selectedLanguage === "en-US" ? "vi-VN" : "en-US";
  chrome.storage.sync.set({ language: selectedLanguage });
  chrome.runtime.sendMessage({
    action: "changeLanguage",
    language: selectedLanguage,
  });
  const message =
    selectedLanguage === "vi-VN"
      ? "Đã chuyển sang tiếng Việt"
      : "Switched to English";
  narrateText(message);
}

// Add these new functions to content.js
let isAreaCaptureMode = false;
let captureStartX = 0;
let captureStartY = 0;
let captureOverlay = null;
let captureSelection = null;

function createCaptureOverlay() {
  // Remove existing overlay if any
  if (captureOverlay) {
    document.body.removeChild(captureOverlay);
  }

  // Create overlay div
  captureOverlay = document.createElement("div");
  captureOverlay.style.position = "fixed";
  captureOverlay.style.top = "0";
  captureOverlay.style.left = "0";
  captureOverlay.style.width = "100%";
  captureOverlay.style.height = "100%";
  captureOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  captureOverlay.style.zIndex = "999999";
  captureOverlay.style.cursor = "crosshair";

  // Create selection rectangle
  captureSelection = document.createElement("div");
  captureSelection.style.position = "absolute";
  captureSelection.style.border = "2px dashed yellow";
  captureSelection.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
  captureSelection.style.display = "none";
  captureOverlay.appendChild(captureSelection);

  // Add overlay to body
  document.body.appendChild(captureOverlay);

  // Add event listeners
  captureOverlay.addEventListener("mousedown", startAreaSelection);
  captureOverlay.addEventListener("mousemove", updateAreaSelection);
  captureOverlay.addEventListener("mouseup", endAreaSelection);
  captureOverlay.addEventListener("keydown", handleCaptureKeyDown);

  // Focus the overlay to capture keyboard events
  captureOverlay.tabIndex = -1;
  captureOverlay.focus();
}

function startAreaSelection(e) {
  if (!isAreaCaptureMode) return;

  captureStartX = e.clientX;
  captureStartY = e.clientY;

  captureSelection.style.left = `${captureStartX}px`;
  captureSelection.style.top = `${captureStartY}px`;
  captureSelection.style.width = "0";
  captureSelection.style.height = "0";
  captureSelection.style.display = "block";
}

function updateAreaSelection(e) {
  if (!isAreaCaptureMode || captureSelection.style.display !== "block") return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const left = Math.min(captureStartX, currentX);
  const top = Math.min(captureStartY, currentY);
  const width = Math.abs(currentX - captureStartX);
  const height = Math.abs(currentY - captureStartY);

  captureSelection.style.left = `${left}px`;
  captureSelection.style.top = `${top}px`;
  captureSelection.style.width = `${width}px`;
  captureSelection.style.height = `${height}px`;
}

async function endAreaSelection(e) {
  if (!isAreaCaptureMode || captureSelection.style.display !== "block") return;

  const currentX = e.clientX;
  const currentY = e.clientY;

  const left = Math.min(captureStartX, currentX);
  const top = Math.min(captureStartY, currentY);
  const width = Math.abs(currentX - captureStartX);
  const height = Math.abs(currentY - captureStartY);

  // Clean up
  document.body.removeChild(captureOverlay);
  captureOverlay = null;
  captureSelection = null;
  isAreaCaptureMode = false;

  // Only proceed if selection is large enough
  if (width < 10 || height < 10) {
    const message =
      selectedLanguage === "vi-VN"
        ? "Vùng chọn quá nhỏ. Vui lòng chọn một vùng lớn hơn."
        : "Selection too small. Please select a larger area.";
    narrateText(message);
    return;
  }

  const boundingRect = {
    x: left + window.scrollX,
    y: top + window.scrollY,
    width,
    height,
  };

  const loadingMessage =
    selectedLanguage === "vi-VN"
      ? "Đang tải mô tả, vui lòng chờ..."
      : "Loading description, please wait...";
  narrateText(loadingMessage);

  try {
    const response = await chrome.runtime.sendMessage({
      action: "describeArea",
      boundingRect: boundingRect,
    });

    // Extract the description from the response object
    const description =
      response?.description ||
      (selectedLanguage === "vi-VN"
        ? "Không nhận được mô tả từ API"
        : "No description received from API");

    narrateText(description);
  } catch (error) {
    console.error("Error describing area:", error);
    const errorMessage =
      selectedLanguage === "vi-VN"
        ? "Lỗi khi mô tả khu vực. Vui lòng thử lại sau."
        : "Error describing the area. Please try again later.";
    narrateText(errorMessage);
  }
}

function handleCaptureKeyDown(e) {
  if (e.key === "Escape") {
    cancelAreaCapture();
  }
}

function cancelAreaCapture() {
  if (captureOverlay) {
    document.body.removeChild(captureOverlay);
    captureOverlay = null;
    captureSelection = null;
  }
  isAreaCaptureMode = false;

  const message =
    selectedLanguage === "vi-VN"
      ? "Đã hủy chế độ chụp ảnh"
      : "Area capture cancelled";
  narrateText(message);
}

function restorePage() {
  if (originalHTML) {
    document.documentElement.innerHTML = originalHTML;
    isSimplified = false;

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

    // Get page text content (remove scripts, styles, etc.)
    const pageText = document.body.innerText;
    const pageUrl = window.location.href;

    const response = await chrome.runtime.sendMessage({
      action: "summarizePage",
      text: pageText,
      url: pageUrl,
      language: selectedLanguage,
    });

    if (response?.summary) {
      // Create simplified view container
      const simplifiedView = document.createElement("div");
      simplifiedView.id = "simplified-view";
      simplifiedView.style.padding = "20px";
      simplifiedView.style.maxWidth = "800px";
      simplifiedView.style.margin = "0 auto";
      simplifiedView.style.fontFamily = "Arial, sans-serif";
      simplifiedView.style.lineHeight = "1.6";

      // Add heading
      const heading = document.createElement("h1");
      heading.textContent =
        selectedLanguage === "vi-VN" ? "Bản tóm tắt trang" : "Page Summary";
      simplifiedView.appendChild(heading);

      // Add summary content
      const content = document.createElement("div");
      content.innerHTML = response.summary;
      simplifiedView.appendChild(content);

      // Replace page content
      document.body.innerHTML = "";
      document.body.appendChild(simplifiedView);

      isSimplified = true;

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
      return "Canvas (Chart)"; // Changed from just "Chart"
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
  } else if (tagName === "canvas") {
    // Return empty string to trigger describeAndNarrateElement
    return "";
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

  // Special handling for canvas elements
  if (element.tagName.toLowerCase() === "canvas") {
    // First try to get accessible description
    const description =
      element.getAttribute("aria-label") ||
      element.closest("[aria-labelledby]")?.textContent ||
      element.closest("figure")?.querySelector("figcaption")?.textContent;

    if (description) {
      narrateText(description);
      return;
    }
  }

  // Ensure the element is in view
  element.scrollIntoView({ behavior: "smooth", block: "center" });

  // Add a small delay to ensure the scroll is complete
  setTimeout(() => {
    const rect = element.getBoundingClientRect();
    const boundingRect = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
    console.log("Element bounding rectangle:", boundingRect);

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
          response.description ||
          (selectedLanguage === "vi-VN"
            ? "Không thể mô tả phần tử này"
            : "Unable to describe this element");
        narrateText(description);
      }
    );
  }, 500);
}

function narrateElement(element) {
  if (!element) return;

  const elementType = getElementType(element);
  chrome.runtime.sendMessage({
    action: "updateElementType",
    elementType: elementType,
  });

  // Always describe canvas elements (charts) using the AI
  if (
    ["Image", "SVG Graphic", "Canvas (Chart)", "Table"].includes(elementType)
  ) {
    describeAndNarrateElement(element);
  } else {
    const content = getNarrationContent(element);
    if (content && content !== "No readable content") {
      narrateText(content);
    } else if (elementType === "Canvas (Chart)") {
      // Fallback for canvas elements
      describeAndNarrateElement(element);
    }
  }
}

function describeCurrentElement() {
  if (currentMode !== "normal") return;

  if (!elements.length) {
    elements = getFocusableElements();
    if (!elements.length) {
      const message =
        selectedLanguage === "vi-VN"
          ? "Không tìm thấy phần tử nào để mô tả"
          : "No elements found to describe";
      narrateText(message);
      return;
    }
    currentIndex = 0;
    highlightElement(elements[currentIndex]);
  }

  if (currentIndex >= 0 && currentIndex < elements.length) {
    describeAndNarrateElement(elements[currentIndex]);
  } else {
    const message =
      selectedLanguage === "vi-VN"
        ? "Không có phần tử nào được chọn để mô tả. Hãy điều hướng trước."
        : "No element selected to describe. Please navigate first.";
    narrateText(message);
  }
}

function moveToNextElement() {
  if (currentMode !== "normal") return;

  if (!elements.length) {
    elements = getFocusableElements();
    if (!elements.length) {
      const message =
        selectedLanguage === "vi-VN"
          ? "Không tìm thấy phần tử nào để điều hướng"
          : "No elements found to navigate";
      narrateText(message);
      return;
    }
    currentIndex = -1;
  }

  do {
    currentIndex = (currentIndex + 1) % elements.length;
    highlightElement(elements[currentIndex]);
    const content = getNarrationContent(elements[currentIndex]);
    if (
      content !== "No readable content" ||
      ["Image", "SVG Graphic", "Canvas (Chart)", "Table"].includes(
        getElementType(elements[currentIndex])
      )
    ) {
      narrateElement(elements[currentIndex]);
      break;
    }
  } while (true);
}

function moveToPreviousElement() {
  if (currentMode !== "normal") return;

  if (!elements.length) {
    elements = getFocusableElements();
    if (!elements.length) {
      const message =
        selectedLanguage === "vi-VN"
          ? "Không tìm thấy phần tử nào để điều hướng"
          : "No elements found to navigate";
      narrateText(message);
      return;
    }
    currentIndex = elements.length;
  }

  do {
    currentIndex = (currentIndex - 1 + elements.length) % elements.length;
    highlightElement(elements[currentIndex]);
    const content = getNarrationContent(elements[currentIndex]);
    if (
      content !== "No readable content" ||
      ["Image", "SVG Graphic", "Canvas (Chart)", "Table"].includes(
        getElementType(elements[currentIndex])
      )
    ) {
      narrateElement(elements[currentIndex]);
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
  } else if (message.action === "startAreaCapture") {
    console.log("Starting area capture mode...");
    isAreaCaptureMode = true;
    createCaptureOverlay();
    const message =
      selectedLanguage === "vi-VN"
        ? "Chế độ chụp ảnh đã bật. Kéo để chọn vùng bạn muốn mô tả. Nhấn ESC để hủy."
        : "Area capture mode enabled. Drag to select the area you want to describe. Press ESC to cancel.";
    narrateText(message);
    sendResponse({ status: "Area capture started" });
  } else if (message.action === "switchMode") {
    switchMode();
    sendResponse({ status: "Mode switched" });
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
