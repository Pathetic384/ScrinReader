import { narrateText } from "./speech-service.js";
import { getElementType } from "./element-types.js";

let elements = [];
let currentIndex = -1;
let isHighlighting = false;
let selectedLanguage = "en-US";

export function initializeNavigation() {
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

  observer.observe(document.body, { childList: true, subtree: true });
}

export function getFocusableElements() {
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

  return Array.from(document.querySelectorAll(selectors.join(", "))).filter(
    (el) =>
      el.offsetParent !== null && window.getComputedStyle(el).display !== "none"
  );
}

export function moveToNextElement() {
  if (!elements.length) {
    elements = getFocusableElements();
    if (!elements.length) {
      const message =
        selectedLanguage === "vi-VN"
          ? "Không tìm thấy phần tử nào để điều hướng"
          : "No elements found to navigate";
      narrateText(message);
      return false;
    }
    currentIndex = -1;
  }

  do {
    currentIndex = (currentIndex + 1) % elements.length;
    const element = elements[currentIndex];
    highlightElement(element);

    if (shouldNarrateElement(element)) {
      narrateElement(element);
      return true;
    }
  } while (true);
}

export function moveToPreviousElement() {
  if (!elements.length) {
    elements = getFocusableElements();
    if (!elements.length) {
      const message =
        selectedLanguage === "vi-VN"
          ? "Không tìm thấy phần tử nào để điều hướng"
          : "No elements found to navigate";
      narrateText(message);
      return false;
    }
    currentIndex = elements.length;
  }

  do {
    currentIndex = (currentIndex - 1 + elements.length) % elements.length;
    const element = elements[currentIndex];
    highlightElement(element);

    if (shouldNarrateElement(element)) {
      narrateElement(element);
      return true;
    }
  } while (true);
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

function shouldNarrateElement(element) {
  const content = getNarrationContent(element);
  const elementType = getElementType(element);

  return (
    content !== "No readable content" ||
    ["Image", "SVG Graphic", "Canvas (Chart)", "Table"].includes(elementType)
  );
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
    return "";
  } else {
    return element.textContent.trim() || "No readable content";
  }
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
    if (content && content !== "No readable content") {
      narrateText(content);
    } else if (elementType === "Canvas (Chart)") {
      describeAndNarrateElement(element);
    }
  }
}

function describeAndNarrateElement(element) {
  const elementType = getElementType(element);

  if (element.tagName.toLowerCase() === "canvas") {
    const description =
      element.getAttribute("aria-label") ||
      element.closest("[aria-labelledby]")?.textContent ||
      element.closest("figure")?.querySelector("figcaption")?.textContent;
    if (description) {
      narrateText(description);
      return;
    }
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" });

  setTimeout(() => {
    const rect = element.getBoundingClientRect();
    const boundingRect = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };

    const loadingMessage =
      selectedLanguage === "vi-VN"
        ? "Đang tải mô tả, vui lòng chờ..."
        : "Loading description, please wait...";
    narrateText(loadingMessage);

    chrome.runtime.sendMessage(
      {
        action: "describeElement",
        elementType,
        boundingRect,
      },
      (response) => {
        const description =
          response?.description ||
          (selectedLanguage === "vi-VN"
            ? "Không thể mô tả phần tử này"
            : "Unable to describe this element");
        narrateText(description);
      }
    );
  }, 500);
}

export function startHighlighting() {
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

export function stopHighlighting() {
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
