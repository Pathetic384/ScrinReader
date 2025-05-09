import { narrateText } from "./speech-service.js";

let originalHTML = null;
let isSimplified = false;

export function initializeSimplify() {
  // No specific initialization needed
}

export function simplifyPage() {
  try {
    const loadingMessage =
      selectedLanguage === "vi-VN"
        ? "Đang đơn giản hóa trang, vui lòng chờ..."
        : "Simplifying page, please wait...";
    narrateText(loadingMessage);

    originalHTML = document.documentElement.outerHTML;
    const pageText = document.body.innerText;
    const pageUrl = window.location.href;

    chrome.runtime.sendMessage(
      {
        action: "summarizePage",
        text: pageText,
        url: pageUrl,
        language: selectedLanguage,
      },
      (response) => {
        if (response?.summary) {
          createSimplifiedView(response.summary);
          isSimplified = true;

          const successMessage =
            selectedLanguage === "vi-VN"
              ? "Trang đã được đơn giản hóa"
              : "Page has been simplified";
          narrateText(successMessage);
        }
      }
    );
  } catch (error) {
    console.error("Error simplifying page:", error);
    const errorMessage =
      selectedLanguage === "vi-VN"
        ? "Lỗi khi đơn giản hóa trang"
        : "Error simplifying page";
    narrateText(errorMessage);
  }
}

export function restorePage() {
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

function createSimplifiedView(summary) {
  const simplifiedView = document.createElement("div");
  simplifiedView.id = "simplified-view";
  simplifiedView.style.padding = "20px";
  simplifiedView.style.maxWidth = "800px";
  simplifiedView.style.margin = "0 auto";
  simplifiedView.style.fontFamily = "Arial, sans-serif";
  simplifiedView.style.lineHeight = "1.6";

  const heading = document.createElement("h1");
  heading.textContent =
    selectedLanguage === "vi-VN" ? "Bản tóm tắt trang" : "Page Summary";
  simplifiedView.appendChild(heading);

  const content = document.createElement("div");
  content.innerHTML = summary;
  simplifiedView.appendChild(content);

  document.body.innerHTML = "";
  document.body.appendChild(simplifiedView);
}
