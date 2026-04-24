import React, { useState } from 'react';
import { Volume2, Copy, Check, Info, Book, MessageSquare, Mic2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { phoneticsVN } from '../data/phonetics_vn';

const WordCard = ({ item, onPlayAudio, isActive }) => {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = useState('overview');

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

  const getPosColor = (pos) => {
    const p = pos?.toLowerCase() || '';
    if (p.includes('noun') || p.includes('danh')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (p.includes('verb') || p.includes('động')) return 'bg-green-100 text-green-700 border-green-200';
    if (p.includes('adj') || p.includes('tính')) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (p.includes('adv') || p.includes('trạng')) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  // Helper to determine word stress from IPA
  const getStressInfo = (ipaString) => {
    if (!ipaString) return null;
    if (ipaString.includes('ˈ')) {
      const cleanIPA = ipaString.replace(/[\/]/g, '');
      const mainStressIdx = cleanIPA.indexOf('ˈ');
      const syllablesBefore = cleanIPA.substring(0, mainStressIdx).split('.').filter(s => s.length > 0).length;
      return `Nhấn mạnh vào âm tiết thứ ${syllablesBefore + 1}.`;
    }
    return 'Từ này chỉ có một âm tiết, không có trọng âm riêng.';
  };

  const generateNarrativeGuide = (ipaString) => {
    if (!ipaString) return "";
    const cleanIPA = ipaString.replace(/[\/ˈˌ.]/g, '');
    const sortedKeys = Object.keys(phoneticsVN).sort((a, b) => b.length - a.length);
    const sounds = [];
    let i = 0;
    while (i < cleanIPA.length) {
      let matched = false;
      for (const key of sortedKeys) {
        if (cleanIPA.slice(i, i + key.length) === key) {
          sounds.push(phoneticsVN[key]);
          i += key.length;
          matched = true;
          break;
        }
      }
      if (!matched) i++;
    }
    if (sounds.length === 0) return "Hiện tại chưa có dữ liệu chi tiết cho từ này.";
    let narrative = "";
    sounds.forEach((sound, idx) => {
      if (idx === 0) {
        narrative += `Để phát âm từ này, bạn hãy bắt đầu bằng cách ${sound.mouth.toLowerCase().replace('.', '')} và ${sound.tongue.toLowerCase().replace('.', '')}. `;
      } else if (idx === sounds.length - 1) {
        narrative += `Cuối cùng, hãy kết thúc bằng việc ${sound.mouth.toLowerCase().replace('.', '')} cho âm /${sound.name}/ (${sound.airflow.toLowerCase()}). `;
      } else {
        const connectors = ["Tiếp theo, hãy ", "Ngay sau đó, ", "Đồng thời kết hợp "];
        const connector = connectors[idx % connectors.length];
        narrative += `${connector}${sound.mouth.toLowerCase().replace('.', '')}. `;
      }
    });
    return narrative;
  };

  const renderClickableIpa = (ipaString) => {
    if (!ipaString) return <span>/.../</span>;
    
    // List of all symbols we support (sorted by length desc to match longer ones like tʃ first)
    const supportedSymbols = Object.keys(phoneticsVN).sort((a, b) => b.length - a.length);
    const symbols = [];
    let i = 0;
    
    // Strip slashes for parsing but we'll add them back in the UI
    const cleanIPA = ipaString.replace(/[\/]/g, '');
    
    while (i < cleanIPA.length) {
      let matched = false;
      for (const symbol of supportedSymbols) {
        if (cleanIPA.slice(i, i + symbol.length) === symbol) {
          symbols.push({ text: symbol, isPhoneme: true });
          i += symbol.length;
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        // If it's a stress mark or dot, just add as plain text
        symbols.push({ text: cleanIPA[i], isPhoneme: false });
        i++;
      }
    }
    
    return (
      <span className="flex items-center">
        /
        {symbols.map((s, idx) => (
          s.isPhoneme ? (
            <button
              key={idx}
              onClick={() => onSelectPhoneme(s.text)}
              className="hover:text-primary-600 hover:bg-primary-50 rounded px-0.5 transition-colors cursor-pointer"
              title={`View detail for /${s.text}/`}
            >
              {s.text}
            </button>
          ) : (
            <span key={idx} className="opacity-40">{s.text}</span>
          )
        ))}
        /
      </span>
    );
  };

  if (!item.found) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-l-4 border-red-400 p-4 rounded-xl shadow-sm flex justify-between items-center"
      >
        <div className="flex flex-col">
          <span className="font-semibold text-slate-700">{item.word}</span>
          <span className="text-[10px] text-red-400">Không tìm thấy từ này trong từ điển</span>
        </div>
        <span className="text-[10px] text-red-500 uppercase font-bold px-2 py-1 bg-red-50 rounded">NOT FOUND</span>
      </motion.div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'TỔNG QUAN', icon: <Info size={14} /> },
    { id: 'usage', label: 'VÍ DỤ & CỤM TỪ', icon: <Book size={14} /> },
    { id: 'pronunciation', label: 'CÁCH PHÁT ÂM', icon: <Mic2 size={14} /> },
  ];

  const ipaText = item.phonetics.uk?.text || item.phonetics.us?.text || '';
  const stressInfo = getStressInfo(ipaText);
  const narrativeGuide = generateNarrativeGuide(ipaText);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: isActive ? 1.02 : 1,
        borderColor: isActive ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.1)' 
      }}
      className={`glass-card p-0 rounded-2xl overflow-hidden transition-all shadow-xl flex flex-col ${
        isActive 
          ? 'ring-2 ring-primary-500 bg-primary-50/20' 
          : 'hover:shadow-2xl group'
      }`}
    >
      <div className="p-5 pb-2">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-2xl font-black text-slate-800 capitalize mb-1">{item.word}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
               {item.entries?.map((e, i) => e.pos && (
                 <span key={i} className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${getPosColor(e.pos)}`}>
                   {e.pos}
                 </span>
               ))}
            </div>
          </div>
          <button 
            onClick={() => copyToClipboard(item.word)}
            className="p-2 text-slate-300 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {['uk', 'us'].map((acc) => {
            const data = item.phonetics[acc];
            if (!data) return null;
            return (
              <div key={acc} className="flex items-center gap-1.5 bg-white/50 border border-slate-100 rounded-lg px-2.5 py-1">
                <span className={`text-[9px] font-black px-1 rounded ${acc === 'uk' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                  {acc.toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-slate-600 font-mono">
                  {renderClickableIpa(data.text)}
                </span>
                <button 
                  onClick={() => playAudio(data.audio)}
                  disabled={!data.audio}
                  className="p-1 text-slate-400 hover:text-primary-600 transition-colors disabled:opacity-20"
                >
                  <Volume2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex border-b border-slate-100 bg-slate-50/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-black tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'text-primary-600 bg-white border-b-2 border-primary-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-5 flex-1 min-h-[250px] bg-white">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" className="space-y-6">
              {/* Vietnamese Meanings */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">Nghĩa Tiếng Việt</h4>
                {item.vnEntries?.map((entry, i) => (
                  <div key={i} className="space-y-2">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border italic ${getPosColor(entry.pos)}`}>
                      {entry.pos}
                    </span>
                    <ul className="space-y-1 pl-1">
                      {entry.meanings.map((m, j) => (
                        <li key={j} className="text-sm font-bold text-slate-700 flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 shrink-0" />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* English Definitions */}
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">English Definitions</h4>
                {item.entries?.map((entry, i) => (
                  <div key={i} className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase">{entry.pos}</span>
                    <ul className="space-y-2">
                      {entry.definitions.slice(0, 3).map((d, j) => (
                        <li key={j} className="text-xs text-slate-600 leading-relaxed pl-3 border-l-2 border-slate-100">
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'usage' && (
            <motion.div key="usage" className="space-y-4">
              {item.examples?.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-300 mb-2 uppercase tracking-tighter">Ví dụ đặt câu</h4>
                  <ul className="space-y-2">
                    {item.examples.map((ex, i) => (
                      <li key={i} className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border-l-2 border-primary-300 italic">
                        "{ex}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.collocations?.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-black text-slate-300 mb-2 uppercase tracking-tighter">Cụm từ đi kèm</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {item.collocations.map((c, i) => (
                      <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 font-bold">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'pronunciation' && (
            <motion.div key="pronunciation" className="space-y-4">
              <div className="bg-primary-600 text-white p-5 rounded-2xl shadow-xl shadow-primary-100">
                <h4 className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">Trọng âm (Word Stress)</h4>
                <p className="text-sm font-black leading-tight">{stressInfo}</p>
              </div>

              <div className="glass-card bg-slate-50/80 p-5 rounded-2xl border-2 border-slate-100">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-tighter mb-4">Hướng dẫn phát âm cả từ "{item.word}"</h4>
                <p className="text-sm text-slate-700 font-medium leading-relaxed bg-white p-4 rounded-xl border border-slate-100 shadow-sm first-letter:text-3xl first-letter:font-black first-letter:text-primary-600 first-letter:mr-1">
                  {narrativeGuide}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default WordCard;
