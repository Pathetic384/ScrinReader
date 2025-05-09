let selectedLanguage = "en-US";

export function initializeSpeech() {
  chrome.storage.sync.get(["language"], (result) => {
    if (result.language) {
      selectedLanguage = result.language;
    }
  });

  window.speechSynthesis.onvoiceschanged = () => {
    console.log("Voices loaded:", window.speechSynthesis.getVoices());
  };
}

export function narrateText(content) {
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

export function setLanguage(language) {
  selectedLanguage = language;
  chrome.storage.sync.set({ language: selectedLanguage }, () => {
    console.log(`Saved language: ${selectedLanguage}`);
  });
}
