import React, { useState, useEffect } from 'react';
import { Search, Sparkles, BookOpen, Trash2, Loader2, ListFilter, Volume2, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWordDetails, parseTextToWords, CACHE_KEY } from './services/dictionary';
import WordCard from './components/WordCard';

function App() {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('vocabulary');
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [playingAccent, setPlayingAccent] = useState(null); // 'uk' or 'us'
  const [isListening, setIsListening] = useState(false);

  // Speech Recognition Logic
  const toggleListening = () => {
    if (isListening) {
      if (window._recognition) {
        try { window._recognition.stop(); } catch(e) {}
        window._recognition = null;
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Chrome hoặc Edge.");
      return;
    }

    // Stop any existing instance if present
    if (window._recognition) {
      try { window._recognition.stop(); } catch(e) {}
    }

    const recognition = new SpeechRecognition();
    window._recognition = recognition; // Prevent garbage collection
    
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      window._recognition = null;
    };
    
    recognition.onresult = (event) => {
      const lastIdx = event.results.length - 1;
      const transcript = event.results[lastIdx][0].transcript;
      setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
      // Auto-trigger analysis
      setTimeout(() => {
        document.getElementById('analyze-btn')?.click();
      }, 500);
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      setIsListening(false);
      
      if (event.error === 'network') {
        alert("Lỗi mạng (Network Error): Trình duyệt không thể kết nối tới máy chủ nhận diện giọng nói. Vui lòng kiểm tra kết nối internet hoặc thử lại sau.");
      } else if (event.error === 'not-allowed') {
        alert("Lỗi quyền truy cập: Vui lòng cho phép trình duyệt sử dụng Microphone.");
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setIsListening(false);
    }
  };

  const startPlaybackAll = (accent) => {
    setPlayingAccent(accent);
    playNext(0, accent);
  };

  const stopPlayback = () => {
    if (window._currentAudio) {
      window._currentAudio.pause();
    }
    setPlayingIndex(-1);
    setPlayingAccent(null);
  };

  // Sequential Playback Engine
  const playNext = (index, accent) => {
    if (index >= results.length) {
      setPlayingIndex(-1);
      setPlayingAccent(null);
      return;
    }

    const item = results[index];
    const audioUrl = item.found ? item.phonetics[accent]?.audio : null;

    if (!item.found || !audioUrl) {
      // Skip words with no audio for this accent
      playNext(index + 1, accent);
      return;
    }

    setPlayingIndex(index);
    setPlayingAccent(accent);
    
    const audio = new Audio(audioUrl);
    audio.onended = () => {
      // Small delay between words for better UX
      setTimeout(() => playNext(index + 1, accent), 500);
    };
    audio.onerror = () => playNext(index + 1, accent);
    audio.play();

    // Store audio object so we can stop it if needed
    window._currentAudio = audio;
  };

  // Load results from cache on mount
  useEffect(() => {
    const cached = localStorage.getItem(`ev-trainer-last-search-${CACHE_KEY}`);
    if (cached) {
      setResults(JSON.parse(cached));
    }
  }, []);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;

    setIsAnalyzing(true);
    const words = parseTextToWords(inputText);
    
    // Process words in batches or sequence
    const wordDetails = [];
    for (const word of words) {
      const details = await fetchWordDetails(word);
      wordDetails.push(details);
    }

    setResults(wordDetails);
    localStorage.setItem(`ev-trainer-last-search-${CACHE_KEY}`, JSON.stringify(wordDetails));
    setIsAnalyzing(false);
  };

  const clearAll = () => {
    setResults([]);
    setInputText('');
    localStorage.removeItem(`ev-trainer-last-search-${CACHE_KEY}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-200">
              <BookOpen size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">English Vocabulary Trainer</h1>
              <p className="text-xs text-slate-500 font-medium">Analyze & Master Pronunciations</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('vocabulary')}
              className={`text-sm font-semibold transition-colors ${activeTab === 'vocabulary' ? 'text-primary-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Vocabulary Analyzer
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <a href="https://github.com" target="_blank" className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">Documentation</a>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            <div className="glass-card p-6 rounded-3xl sticky top-28">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-800">
                  <Sparkles size={20} className="text-primary-500" />
                  <h2 className="font-bold">Input Text</h2>
                </div>
                <button 
                   onClick={clearAll}
                   className="text-xs font-semibold text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              </div>

              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste English text, a list of words, or a sentence here..."
                className="w-full h-64 bg-slate-50/50 border border-slate-200 rounded-2xl p-4 text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none mb-4"
              />

              <div className="flex gap-2 mb-4">
                <button 
                  onClick={handleAnalyze}
                  id="analyze-btn"
                  disabled={isAnalyzing || !inputText.trim()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 group"
                >
                  {isAnalyzing ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Search size={20} className="group-hover:scale-110 transition-transform" />
                  )}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Vocabulary'}
                </button>

                <button
                  onClick={toggleListening}
                  className={`p-4 rounded-2xl flex items-center justify-center transition-all ${
                    isListening 
                      ? 'bg-red-100 text-red-600 animate-pulse' 
                      : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                  }`}
                  title={isListening ? "Click to stop listening" : "Speak to analyze"}
                >
                  {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              </div>

              <div className="mt-6 flex gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-100 pt-6">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Automatic Parsing
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Audio Pronunciation
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Results */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800">
                <ListFilter size={20} className="text-primary-500" />
                <h2 className="font-bold">Analysis Results ({results.length})</h2>
              </div>
              
              {results.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => playingAccent === 'uk' ? stopPlayback() : startPlaybackAll('uk')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      playingAccent === 'uk' 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                        : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
                    }`}
                  >
                    <Volume2 size={18} className={playingAccent === 'uk' ? 'animate-pulse' : ''} />
                    {playingAccent === 'uk' ? 'Stop' : 'Listen UK'}
                  </button>
                  
                  <button
                    onClick={() => playingAccent === 'us' ? stopPlayback() : startPlaybackAll('us')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      playingAccent === 'us' 
                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                        : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                    }`}
                  >
                    <Volume2 size={18} className={playingAccent === 'us' ? 'animate-pulse' : ''} />
                    {playingAccent === 'us' ? 'Stop' : 'Listen US'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {results.length > 0 ? (
                  results.map((item, idx) => (
                    <WordCard 
                      key={`${item.word}-${idx}`} 
                      item={item} 
                      isActive={playingIndex === idx}
                    />
                  ))
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full h-80 flex flex-col items-center justify-center text-center opacity-40 grayscale"
                  >
                    <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                      <Search size={40} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">No words analyzed yet.</p>
                    <p className="text-xs text-slate-400 max-w-xs mt-1">Start by pasting some text into the analyzer on the left.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-400">© 2026 English Vocabulary Trainer. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs font-bold text-slate-400 hover:text-primary-600 transition-colors uppercase tracking-widest">Privacy</a>
            <a href="#" className="text-xs font-bold text-slate-400 hover:text-primary-600 transition-colors uppercase tracking-widest">Terms</a>
            <a href="#" className="text-xs font-bold text-slate-400 hover:text-primary-600 transition-colors uppercase tracking-widest">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
