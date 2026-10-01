/**
 * Robust audio player service for English vocabulary pronunciation.
 * Provides multi-tier playback:
 * Tier 1: Real human audio file (Oxford / dictionary audio URL).
 * Tier 2: Google Translate TTS stream (en-GB for UK, en-US for US).
 * Tier 3: Browser native Web Speech API (window.speechSynthesis) as a guaranteed offline fallback.
 */

let activeAudio = null;

/**
 * Speaks a word using the browser's Web Speech API.
 * @param {string} word 
 * @param {'uk' | 'us'} accent 
 * @returns {Promise<boolean>}
 */
export const speakWithWebSpeech = (word, accent = 'us') => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(word);
      const targetLang = accent === 'uk' ? 'en-GB' : 'en-US';
      utterance.lang = targetLang;
      utterance.rate = 0.9; // Slightly slower for language learners

      // Select matching voice if available
      const voices = window.speechSynthesis.getVoices() || [];
      const matchedVoice = voices.find(v => v.lang === targetLang || v.lang.replace('_', '-') === targetLang)
        || voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onend = () => resolve(true);
      utterance.onerror = (e) => {
        console.warn('Web Speech API error:', e);
        resolve(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis invocation failed:', err);
      resolve(false);
    }
  });
};

/**
 * Attempts to play an audio URL using HTMLAudioElement.
 * @param {string} url 
 * @returns {Promise<void>}
 */
const playAudioUrl = (url) => {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string' || url.includes('dictionary.cambridge.org')) {
      return reject(new Error('Blocked or invalid audio URL'));
    }

    const audio = new Audio(url);
    activeAudio = audio;
    window._currentAudio = audio;

    let hasEnded = false;

    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      if (activeAudio === audio) {
        activeAudio = null;
      }
    };

    audio.onended = () => {
      if (!hasEnded) {
        hasEnded = true;
        cleanup();
        resolve();
      }
    };

    audio.onerror = (err) => {
      if (!hasEnded) {
        hasEnded = true;
        cleanup();
        reject(err || new Error('Audio load error'));
      }
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (!hasEnded) {
          hasEnded = true;
          cleanup();
          reject(err);
        }
      });
    }
  });
};

/**
 * Stops any currently active audio or speech synthesis.
 */
export const stopWordAudio = () => {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (e) {}
    activeAudio = null;
  }
  if (typeof window !== 'undefined') {
    if (window._currentAudio) {
      try {
        window._currentAudio.pause();
        window._currentAudio.currentTime = 0;
      } catch (e) {}
      window._currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
};

/**
 * Plays the pronunciation of a word with robust multi-tiered fallback.
 * @param {Object} options
 * @param {string} options.word - The word to pronounce
 * @param {'uk' | 'us'} [options.accent='us'] - Desired accent
 * @param {string} [options.audioUrl] - Primary audio URL if available
 * @param {Function} [options.onStart] - Callback when playback starts
 * @param {Function} [options.onEnd] - Callback when playback finishes
 * @returns {Promise<boolean>}
 */
export const playWordAudio = async ({ word, accent = 'us', audioUrl, onStart, onEnd }) => {
  if (!word) return false;
  const cleanWord = word.trim();
  const normalizedAccent = accent === 'uk' ? 'uk' : 'us';

  // Stop previous sounds
  stopWordAudio();

  onStart?.();

  const handleFinish = () => {
    onEnd?.();
  };

  // Tier 1: Try Primary Audio URL (if not blocked Cambridge)
  if (audioUrl && !audioUrl.includes('dictionary.cambridge.org')) {
    try {
      await playAudioUrl(audioUrl);
      handleFinish();
      return true;
    } catch (err) {
      console.warn(`Primary audio playback failed for "${cleanWord}", attempting Google TTS fallback:`, err);
    }
  }

  // Tier 2: Try Google Translate TTS Stream
  try {
    const langCode = normalizedAccent === 'uk' ? 'en-GB' : 'en-US';
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${langCode}&q=${encodeURIComponent(cleanWord)}`;
    await playAudioUrl(googleTtsUrl);
    handleFinish();
    return true;
  } catch (err) {
    console.warn(`Google TTS playback failed for "${cleanWord}", attempting Web Speech fallback:`, err);
  }

  // Tier 3: Native Web Speech API Fallback
  try {
    const success = await speakWithWebSpeech(cleanWord, normalizedAccent);
    handleFinish();
    return success;
  } catch (err) {
    console.error(`All pronunciation methods failed for "${cleanWord}":`, err);
    handleFinish();
    return false;
  }
};
