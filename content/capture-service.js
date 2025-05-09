import { narrateText } from "./speech-service.js";

let isAreaCaptureMode = false;
let captureStartX = 0;
let captureStartY = 0;
let captureOverlay = null;
let captureSelection = null;

export function initializeCapture() {
  // No specific initialization needed
}

export function createCaptureOverlay() {
  if (captureOverlay) {
    document.body.removeChild(captureOverlay);
  }

  captureOverlay = document.createElement("div");
  captureOverlay.style.position = "fixed";
  captureOverlay.style.top = "0";
  captureOverlay.style.left = "0";
  captureOverlay.style.width = "100%";
  captureOverlay.style.height = "100%";
  captureOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  captureOverlay.style.zIndex = "999999";
  captureOverlay.style.cursor = "crosshair";

  captureSelection = document.createElement("div");
  captureSelection.style.position = "absolute";
  captureSelection.style.border = "2px dashed yellow";
  captureSelection.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
  captureSelection.style.display = "none";
  captureOverlay.appendChild(captureSelection);

  document.body.appendChild(captureOverlay);

  captureOverlay.addEventListener("mousedown", startAreaSelection);
  captureOverlay.addEventListener("mousemove", updateAreaSelection);
  captureOverlay.addEventListener("mouseup", endAreaSelection);
  captureOverlay.addEventListener("keydown", handleCaptureKeyDown);

  captureOverlay.tabIndex = -1;
  captureOverlay.focus();
}

export function startAreaCapture() {
  isAreaCaptureMode = true;
  createCaptureOverlay();

  const message =
    selectedLanguage === "vi-VN"
      ? "Chế độ chụp ảnh đã bật. Kéo để chọn vùng bạn muốn mô tả. Nhấn ESC để hủy."
      : "Area capture mode enabled. Drag to select the area you want to describe. Press ESC to cancel.";
  narrateText(message);
}

export function cancelAreaCapture() {
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

export function cropScreenshot(
  screenshotDataUrl,
  boundingRect,
  devicePixelRatio
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = screenshotDataUrl;

    img.onload = () => {
      let x = boundingRect.x * devicePixelRatio;
      let y = boundingRect.y * devicePixelRatio;
      let width = boundingRect.width * devicePixelRatio;
      let height = boundingRect.height * devicePixelRatio;

      width = Math.max(width, 10);
      height = Math.max(height, 10);

      x = Math.max(0, Math.min(x, img.width - width));
      y = Math.max(0, Math.min(y, img.height - height));
      width = Math.min(width, img.width - x);
      height = Math.min(height, img.height - y);

      if (width <= 0 || height <= 0) {
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
      reject(new Error("Failed to load screenshot image"));
    };
  });
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

  document.body.removeChild(captureOverlay);
  captureOverlay = null;
  captureSelection = null;
  isAreaCaptureMode = false;

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
