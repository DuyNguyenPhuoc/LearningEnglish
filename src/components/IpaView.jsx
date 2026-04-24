import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Volume2, Info } from 'lucide-react';
import { ipaData } from '../data/ipa_44';

const IpaView = ({ selectedSymbol, onSelectSymbol, onSearchWord, currentResults = [] }) => {
  const monophthongs = ipaData.filter(p => p.type === 'Monophthong');
  const diphthongs = ipaData.filter(p => p.type === 'Diphthong');
  const consonants = ipaData.filter(p => p.category === 'Consonants');

  const selectedPhoneme = ipaData.find(p => p.symbol === selectedSymbol) || null;

  const audioRef = React.useRef(null);
  const stopTimeoutRef = React.useRef(null);

  const playSound = (e, phoneme) => {
    e.stopPropagation();
    if (!phoneme.audioUrl) return;

    // Clear any pending stop timeout
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
    }

    // Initialize or reuse audio object
    if (!audioRef.current) {
      audioRef.current = new Audio(phoneme.audioUrl);
    }

    const audio = audioRef.current;

    // If it's a sprite-based phoneme
    if (phoneme.startTime !== undefined) {
      audio.pause();
      audio.currentTime = phoneme.startTime;
      audio.play().catch(err => console.error("Failed to play IPA audio:", err));

      // Stop after 1 second (duration)
      stopTimeoutRef.current = setTimeout(() => {
        audio.pause();
      }, (phoneme.endTime - phoneme.startTime) * 1000);
    } else {
      // Legacy behavior for individual files
      const tempAudio = new Audio(phoneme.audioUrl);
      tempAudio.play().catch(err => console.error("Failed to play IPA audio:", err));
    }
  };

  // Find words in current analysis results that use this phoneme
  const relatedWords = selectedSymbol ? currentResults.filter(item => {
    if (!item.found) return false;
    const ukIpa = item.phonetics?.uk?.text || '';
    const usIpa = item.phonetics?.us?.text || '';
    return ukIpa.includes(selectedSymbol) || usIpa.includes(selectedSymbol);
  }) : [];

  const PhonemeCard = ({ phoneme }) => {
    const isSelected = selectedSymbol === phoneme.symbol;
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onSelectSymbol(phoneme.symbol)}
        className={`group relative p-4 rounded-2xl flex flex-col items-center justify-center transition-all shadow-sm hover:shadow-md
          ${isSelected ? 'ring-4 ring-primary-500 z-10' : ''}
          ${phoneme.category === 'Vowels' ? 'bg-primary-50 text-primary-700 border border-primary-100 hover:bg-primary-100' : 'bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100'}
        `}
      >
        <span className="text-3xl font-bold font-serif">/{phoneme.symbol}/</span>
        <span className="text-[10px] mt-1 opacity-70 uppercase tracking-wider font-bold">{phoneme.type}</span>
        <button 
          onClick={(e) => playSound(e, phoneme)}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/50 hover:bg-white text-current shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
          title="Hear sound"
        >
          <Volume2 size={12} />
        </button>
      </motion.button>
    );
  };

  return (
    <section className="flex flex-col gap-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
          <Info size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">44 IPA Sounds</h2>
          <p className="text-sm text-slate-500">Master the International Phonetic Alphabet</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle: The Chart */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Vowels */}
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary-500"></div>
              Vowels (Nguyên âm)
            </h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Monophthongs (Nguyên âm đơn)</h4>
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
                  {monophthongs.map(p => <PhonemeCard key={p.symbol} phoneme={p} />)}
                </div>
              </div>
              
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Diphthongs (Nguyên âm đôi)</h4>
                <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
                  {diphthongs.map(p => <PhonemeCard key={p.symbol} phoneme={p} />)}
                </div>
              </div>
            </div>
          </div>

          {/* Consonants */}
          <div className="glass-card p-6 rounded-3xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
              Consonants (Phụ âm)
            </h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {consonants.map(p => <PhonemeCard key={p.symbol} phoneme={p} />)}
            </div>
          </div>

        </div>

        {/* Right: The Detail Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-28">
            <AnimatePresence mode="wait">
              {selectedPhoneme ? (
                <motion.div
                  key={selectedPhoneme.symbol}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-card p-6 rounded-3xl shadow-xl border border-slate-200"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{selectedPhoneme.category} • {selectedPhoneme.type}</span>
                      <div className="flex items-center gap-4">
                        <h2 className="text-6xl font-bold text-slate-800 font-serif">/{selectedPhoneme.symbol}/</h2>
                        <button 
                          onClick={(e) => playSound(e, selectedPhoneme)}
                          className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center hover:bg-primary-200 hover:scale-110 transition-all shadow-sm"
                          title="Listen to examples"
                        >
                          <Volume2 size={24} />
                        </button>
                      </div>
                    </div>
                    <button 
                      onClick={() => onSelectSymbol(null)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <h4 className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        👄 Khẩu hình miệng
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {selectedPhoneme.mouth}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                        🗣️ Cách phát âm
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {selectedPhoneme.instruction}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Ví dụ (Examples)</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedPhoneme.examples.map(ex => (
                          <button 
                            key={ex} 
                            onClick={() => onSearchWord(ex)}
                            className="px-3 py-1.5 bg-white border border-slate-200 shadow-sm rounded-lg text-sm font-medium text-slate-700 hover:border-primary-500 hover:text-primary-600 transition-all"
                            title={`Search "${ex}" in dictionary`}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>

                    {relatedWords.length > 0 && (
                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                          📚 Có trong kết quả phân tích
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {relatedWords.map(item => (
                            <button 
                              key={item.word}
                              onClick={() => onSearchWord(item.word)}
                              className="px-2 py-1 bg-green-50 border border-green-100 rounded text-xs font-bold text-green-700 hover:bg-green-100 transition-colors"
                            >
                              {item.word}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass-card p-8 rounded-3xl flex flex-col items-center justify-center text-center h-full min-h-[400px] border border-dashed border-slate-300"
                >
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                    <Volume2 size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 mb-2">Select a Sound</h3>
                  <p className="text-sm text-slate-500 max-w-[200px]">
                    Click on any IPA symbol from the chart to view detailed pronunciation instructions and examples.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </section>
  );
};

export default IpaView;
