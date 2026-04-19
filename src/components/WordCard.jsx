import React from 'react';
import { Volume2, Copy, Check, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const WordCard = ({ item, onPlayAudio, isActive }) => {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const playAudio = (audioUrl) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play();
    }
  };

  if (!item.found) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-l-4 border-red-400 p-4 rounded-xl shadow-sm flex justify-between items-center"
      >
        <span className="font-semibold text-slate-700">{item.word}</span>
        <span className="text-xs text-red-500 uppercase font-bold px-2 py-1 bg-red-50 rounded">Not Found</span>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: isActive ? 1.02 : 1,
        borderColor: isActive ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.2)' 
      }}
      className={`glass-card p-6 rounded-2xl transition-all shadow-xl ${
        isActive 
          ? 'ring-2 ring-primary-500 bg-primary-50/50' 
          : 'hover:shadow-2xl hover:-translate-y-1 group'
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Header: Word and Copy */}
        <div className="flex justify-between items-start">
          <h3 className="text-2xl font-bold text-slate-800 capitalize leading-none">{item.word}</h3>
          <button 
            onClick={() => copyToClipboard(item.word)}
            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Copy word"
          >
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>

        {/* Phonetics Section */}
        <div className="flex flex-wrap gap-3">
          {/* UK */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full pl-3 pr-1 py-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">UK</span>
            <span className="text-sm font-medium text-slate-600">{item.phonetics.uk?.text || '/.../'}</span>
            <button 
              onClick={() => playAudio(item.phonetics.uk?.audio)}
              disabled={!item.phonetics.uk?.audio}
              className="p-1.5 text-primary-600 hover:bg-primary-100 rounded-full disabled:opacity-30 transition-colors"
            >
              <Volume2 size={16} />
            </button>
          </div>

          {/* US */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-full pl-3 pr-1 py-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">US</span>
            <span className="text-sm font-medium text-slate-600">{item.phonetics.us?.text || '/.../'}</span>
            <button 
              onClick={() => playAudio(item.phonetics.us?.audio)}
              disabled={!item.phonetics.us?.audio}
              className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-full disabled:opacity-30 transition-colors"
            >
              <Volume2 size={16} />
            </button>
          </div>
        </div>

        {/* Definition Snippet */}
        <p className="text-sm text-slate-500 italic line-clamp-2 border-t border-slate-100 pt-3">
          {item.definitions}
        </p>
      </div>
    </motion.div>
  );
};

export default WordCard;
