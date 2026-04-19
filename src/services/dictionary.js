import axios from 'axios';

const API_BASE_URL = '/api/dictionary';
const CACHE_KEY = 'ev-trainer-cache-v2'; // Changed key to clear old incompatible cache

// Simple in-memory cache for the current session
const memoryCache = {};

/**
 * Fetches word details from the local Cambridge scraping proxy.
 * Implements LocalStorage and Memory caching.
 */
export const fetchWordDetails = async (word) => {
  const normalizedWord = word.toLowerCase().trim();

  // 1. Check Memory Cache
  if (memoryCache[normalizedWord]) {
    return memoryCache[normalizedWord];
  }

  // 2. Check LocalStorage Cache
  const localCache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  if (localCache[normalizedWord]) {
    memoryCache[normalizedWord] = localCache[normalizedWord];
    return localCache[normalizedWord];
  }

  try {
    // Calling our local Vite proxy
    const response = await axios.get(`${API_BASE_URL}/${normalizedWord}`);
    const result = response.data;

    // Save to Cache
    memoryCache[normalizedWord] = result;
    localCache[normalizedWord] = result;
    localStorage.setItem(CACHE_KEY, JSON.stringify(localCache));

    return result;
  } catch (error) {
    const errorResult = {
      word: normalizedWord,
      found: false,
      error: error.response?.status === 404 ? 'Not found in Cambridge' : 'Proxy Error'
    };
    
    // Cache the "not found" to avoid repeated failed calls
    memoryCache[normalizedWord] = errorResult;
    return errorResult;
  }
};

/**
 * Parses text into unique words.
 * Removes punctuation and numbers.
 */
export const parseTextToWords = (text) => {
  if (!text) return [];
  
  // Split by non-alphabetic characters, filter out empty strings
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  
  // Return unique words
  return [...new Set(words)];
};
