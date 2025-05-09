const API_KEY = "AIzaSyAAomWzcEaQZeF4pjGViuEG9pLjYfhbOBg";
let selectedLanguage = "en-US";

export async function describeImage(croppedBase64) {
  try {
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
    return (
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join(" ") ||
      (selectedLanguage === "vi-VN"
        ? "Không thể mô tả khu vực này."
        : "Unable to describe this area.")
    );
  } catch (error) {
    console.error("API Error:", error);
    return selectedLanguage === "vi-VN"
      ? "Lỗi khi mô tả khu vực. Vui lòng thử lại sau."
      : "Error describing the area. Please try again later.";
  }
}

export async function summarizeContent(text, url, language) {
  try {
    const prompt =
      language === "vi-VN"
        ? `Hãy tóm tắt nội dung chính của trang web này thành các điểm chính. Mỗi điểm nên là một dòng riêng biệt. Giữ lại:
         - Tiêu đề chính
         - Các mục quan trọng
         - Dữ liệu bảng (nếu có)
         - Liên kết quan trọng
         Bỏ qua quảng cáo và các yếu tố không cần thiết. Trả về kết quả dưới dạng HTML đơn giản.`
        : `Summarize the main content of this web page into key points. Each point should be a separate line. Keep:
         - Main headings
         - Important items
         - Table data (if any)
         - Important links
         Skip ads and non-essential elements. Return result as simple HTML.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { text: `Page URL: ${url}\n\nPage Content:\n${text}` },
              ],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    return (
      data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join(" ") || text
    );
  } catch (error) {
    console.error("Summarization Error:", error);
    return text;
  }
}

export function setLanguage(language) {
  selectedLanguage = language;
}
