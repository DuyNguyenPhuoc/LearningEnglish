import React, { useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, ListTree, ZoomIn, ZoomOut, Maximize, Eye, EyeOff, RotateCcw,
  ChevronRight, ChevronLeft, X, Volume2, Search, Lightbulb, AlertTriangle, Info,
} from 'lucide-react';
import { pronunciationMindmap } from '../data/pronunciation_mindmap';
import { ipaData } from '../data/ipa_44';
import { playWordAudio } from '../services/audioPlayer';

// Static class strings so Tailwind can pick them up
const THEMES = {
  sky: {
    stroke: '#0ea5e9',
    branch: 'bg-sky-500 text-white shadow-sky-200',
    group: 'bg-white border-sky-300 text-sky-700',
    leaf: 'bg-sky-50 border-sky-200 hover:border-sky-400',
    hint: 'text-sky-700',
    ring: 'ring-sky-500',
    hl: 'text-sky-600 decoration-sky-300',
    rail: 'border-sky-200',
  },
  rose: {
    stroke: '#f43f5e',
    branch: 'bg-rose-500 text-white shadow-rose-200',
    group: 'bg-white border-rose-300 text-rose-700',
    leaf: 'bg-rose-50 border-rose-200 hover:border-rose-400',
    hint: 'text-rose-700',
    ring: 'ring-rose-500',
    hl: 'text-rose-600 decoration-rose-300',
    rail: 'border-rose-200',
  },
  amber: {
    stroke: '#f59e0b',
    branch: 'bg-amber-500 text-white shadow-amber-200',
    group: 'bg-white border-amber-300 text-amber-700',
    leaf: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    hint: 'text-amber-700',
    ring: 'ring-amber-500',
    hl: 'text-amber-600 decoration-amber-300',
    rail: 'border-amber-200',
  },
  emerald: {
    stroke: '#10b981',
    branch: 'bg-emerald-500 text-white shadow-emerald-200',
    group: 'bg-white border-emerald-300 text-emerald-700',
    leaf: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    hint: 'text-emerald-700',
    ring: 'ring-emerald-500',
    hl: 'text-emerald-600 decoration-emerald-300',
    rail: 'border-emerald-200',
  },
  violet: {
    stroke: '#8b5cf6',
    branch: 'bg-violet-500 text-white shadow-violet-200',
    group: 'bg-white border-violet-300 text-violet-700',
    leaf: 'bg-violet-50 border-violet-200 hover:border-violet-400',
    hint: 'text-violet-700',
    ring: 'ring-violet-500',
    hl: 'text-violet-600 decoration-violet-300',
    rail: 'border-violet-200',
  },
  teal: {
    stroke: '#14b8a6',
    branch: 'bg-teal-500 text-white shadow-teal-200',
    group: 'bg-white border-teal-300 text-teal-700',
    leaf: 'bg-teal-50 border-teal-200 hover:border-teal-400',
    hint: 'text-teal-700',
    ring: 'ring-teal-500',
    hl: 'text-teal-600 decoration-teal-300',
    rail: 'border-teal-200',
  },
  orange: {
    stroke: '#f97316',
    branch: 'bg-orange-500 text-white shadow-orange-200',
    group: 'bg-white border-orange-300 text-orange-700',
    leaf: 'bg-orange-50 border-orange-200 hover:border-orange-400',
    hint: 'text-orange-700',
    ring: 'ring-orange-500',
    hl: 'text-orange-600 decoration-orange-300',
    rail: 'border-orange-200',
  },
  indigo: {
    stroke: '#6366f1',
    branch: 'bg-indigo-500 text-white shadow-indigo-200',
    group: 'bg-white border-indigo-300 text-indigo-700',
    leaf: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
    hint: 'text-indigo-700',
    ring: 'ring-indigo-500',
    hl: 'text-indigo-600 decoration-indigo-300',
    rail: 'border-indigo-200',
  },
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.6;
const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +s.toFixed(2)));

const knownPhonemes = new Set(ipaData.map(p => p.symbol));

// ---------- Tree helpers ----------

const collectExpandable = (node, acc = []) => {
  if (node.children?.length) {
    acc.push(node.id);
    node.children.forEach(c => collectExpandable(c, acc));
  }
  return acc;
};

const collectLeaves = (node, acc = []) => {
  if (!node.children?.length) acc.push(node);
  else node.children.forEach(c => collectLeaves(c, acc));
  return acc;
};

// id → { node, branch, trail } where trail is the list of ancestors below the root
const buildIndex = (root) => {
  const index = new Map();
  const walk = (node, branch, trail) => {
    index.set(node.id, { node, branch, trail });
    node.children?.forEach(c => {
      const b = node === root ? c : branch;
      walk(c, b, node === root ? [] : [...trail, node]);
    });
  };
  walk(root, null, []);
  return index;
};

const collectEdges = (root, expanded, oneSided) => {
  const edges = [];
  const walk = (node, branch, depth) => {
    if (node !== root && !expanded.has(node.id)) return;
    node.children?.forEach(c => {
      const b = branch || c;
      edges.push({
        from: node.id,
        to: c.id,
        color: THEMES[b.color].stroke,
        side: oneSided ? 'right' : b.side,
        depth: depth + 1,
      });
      walk(c, b, depth + 1);
    });
  };
  walk(root, null, 0);
  return edges;
};

// In recall mode a group's hint gives away its leaves, so keep it hidden until they are all revealed
const isGroupHintHidden = (node, recall, revealed) => recall && !node.children.every(c => revealed.has(c.id));

// ---------- Search ----------

// Accent-insensitive so "trong am" finds "trọng âm"
const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

const leafSearchText = (leaf) => {
  const words = (list = []) => list.flatMap(ex => [ex.word, ex.display, ex.ipa, ex.note]);
  return normalize([
    leaf.title, leaf.hint, leaf.rule, leaf.mnemonic, leaf.note,
    ...(leaf.points || []),
    ...words(leaf.examples),
    ...words(leaf.exceptions),
    ...(leaf.pairs || []).flatMap(p => [p.label, ...words([p.a, p.b])]),
  ].filter(Boolean).join(' '));
};

const subtreeHasMatch = (node, matchIds) => (
  node.children?.length ? node.children.some(c => subtreeHasMatch(c, matchIds)) : matchIds.has(node.id)
);

// ---------- Small pieces ----------

// *x* = stressed / highlighted part, ~x~ = silent letter
const RichWord = ({ text, hl }) => (
  <>
    {text.split(/(\*[^*]+\*|~[^~]+~)/g).filter(Boolean).map((part, i) => {
      if (part.startsWith('*')) {
        return <span key={i} className={`font-black underline decoration-2 underline-offset-4 ${hl}`}>{part.slice(1, -1)}</span>;
      }
      if (part.startsWith('~')) {
        return <span key={i} className="text-slate-300 line-through decoration-slate-400 decoration-2">{part.slice(1, -1)}</span>;
      }
      return <span key={i}>{part}</span>;
    })}
  </>
);

const playExample = (ex) => playWordAudio({ word: ex.word, accent: ex.accent || 'uk' });

const ExampleRow = ({ ex, theme, onSearchWord, warn = false }) => (
  <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border ${warn ? 'bg-orange-50/60 border-orange-100' : 'bg-white border-slate-100'}`}>
    <button
      onClick={() => playExample(ex)}
      className="w-8 h-8 shrink-0 rounded-full bg-slate-100 text-slate-500 hover:bg-primary-100 hover:text-primary-600 flex items-center justify-center transition-colors"
      title={`Nghe "${ex.word}"${ex.accent === 'us' ? ' (giọng Mỹ)' : ''}`}
    >
      <Volume2 size={14} />
    </button>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-slate-800 leading-tight">
        <RichWord text={ex.display || ex.word} hl={theme.hl} />
        {ex.note && <span className="ml-1.5 text-[11px] font-medium text-slate-400">{ex.note}</span>}
        {ex.accent === 'us' && <span className="ml-1.5 text-[9px] font-black px-1 rounded bg-blue-100 text-blue-600">US</span>}
      </div>
      {ex.ipa && <div className="text-xs font-mono text-slate-500 mt-0.5">{ex.ipa}</div>}
    </div>
    {!ex.word.includes(' ') && (
      <button
        onClick={() => onSearchWord(ex.word)}
        className="p-1.5 shrink-0 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        title={`Tra "${ex.word}" trong Vocabulary Analyzer`}
      >
        <Search size={14} />
      </button>
    )}
  </div>
);

const PairWord = ({ ex, theme, align }) => (
  <button
    onClick={() => playExample(ex)}
    className={`flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-white border border-slate-100 hover:border-primary-300 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
    title={`Nghe "${ex.word}"`}
  >
    <div className="text-sm font-semibold text-slate-800 leading-tight">
      <RichWord text={ex.display || ex.word} hl={theme.hl} />
    </div>
    <div className="text-xs font-mono text-slate-500 mt-0.5">{ex.ipa}</div>
    {ex.note && <div className="text-[11px] text-slate-400 mt-0.5">{ex.note}</div>}
  </button>
);

const SectionTitle = ({ children }) => (
  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{children}</h4>
);

// ---------- Detail panel ----------

const DetailPanel = ({ entry, position, recall, isRevealed, onReveal, onClose, onPrev, onNext, onSearchWord, onSelectPhoneme }) => {
  const { node, branch, trail } = entry;
  const theme = THEMES[branch.color];
  const hidden = recall && !isRevealed;
  const phonemes = (node.phonemes || []).filter(s => knownPhonemes.has(s));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-slate-900/30 md:hidden"
      />
      <motion.aside
        key="panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.2 }}
        className="fixed z-50 inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl md:inset-x-auto md:right-4 md:top-24 md:bottom-4 md:w-[420px] md:max-h-none md:rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className={`px-5 pt-4 pb-4 ${theme.branch}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-90 truncate">
              {branch.emoji} {trail.map(t => t.title).join(' › ')}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors" title="Đóng (Esc)">
              <X size={16} />
            </button>
          </div>
          <h3 className="text-2xl font-black mt-2 leading-tight">{node.title}</h3>
          <p className={`text-sm font-semibold mt-1 opacity-95 ${hidden ? 'blur-[6px] select-none' : ''}`}>{node.hint}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 bg-slate-50/60">
          {hidden ? (
            <div className="flex flex-col items-center text-center py-10">
              <div className="text-4xl mb-3">🧠</div>
              <p className="text-sm text-slate-600 max-w-[260px] mb-5">
                Thử tự nhớ lại quy tắc, mẹo nhớ và vài ví dụ trước khi lật đáp án.
              </p>
              <button onClick={onReveal} className="btn-primary flex items-center gap-2">
                <Eye size={18} /> Hiện đáp án
              </button>
            </div>
          ) : (
            <>
              {node.rule && (
                <div>
                  <SectionTitle>📌 Quy tắc</SectionTitle>
                  <p className="text-sm text-slate-700 leading-relaxed">{node.rule}</p>
                  {node.points && (
                    <ul className="mt-2 space-y-1.5">
                      {node.points.map(p => (
                        <li key={p} className="text-sm text-slate-700 flex gap-2">
                          <span className={`font-black ${theme.hint}`}>•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {node.mnemonic && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex gap-2.5">
                  <Lightbulb size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Mẹo nhớ</div>
                    <p className="text-sm font-semibold text-amber-900 leading-relaxed">{node.mnemonic}</p>
                  </div>
                </div>
              )}

              {node.pairs && (
                <div>
                  <SectionTitle>⚖️ So sánh cặp</SectionTitle>
                  <div className="space-y-2">
                    {node.pairs.map((pair, i) => (
                      <div key={i} className="flex items-stretch gap-2">
                        <PairWord ex={pair.a} theme={theme} />
                        <div className={`w-14 shrink-0 flex items-center justify-center text-center text-[10px] font-black font-mono leading-tight ${theme.hint}`}>
                          {pair.label || '↔'}
                        </div>
                        <PairWord ex={pair.b} theme={theme} align="right" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {node.examples && (
                <div>
                  <SectionTitle>🔊 Ví dụ — bấm loa để nghe</SectionTitle>
                  <div className="space-y-1.5">
                    {node.examples.map((ex, i) => (
                      <ExampleRow key={`${ex.word}-${i}`} ex={ex} theme={theme} onSearchWord={onSearchWord} />
                    ))}
                  </div>
                </div>
              )}

              {node.exceptions && (
                <div>
                  <h4 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Ngoại lệ cần nhớ
                  </h4>
                  <div className="space-y-1.5">
                    {node.exceptions.map((ex, i) => (
                      <ExampleRow key={`${ex.word}-${i}`} ex={ex} theme={theme} onSearchWord={onSearchWord} warn />
                    ))}
                  </div>
                </div>
              )}

              {node.note && (
                <div className="p-3 rounded-2xl bg-white border border-slate-200 flex gap-2.5">
                  <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600 leading-relaxed">{node.note}</p>
                </div>
              )}

              {phonemes.length > 0 && (
                <div>
                  <SectionTitle>🔤 Xem khẩu hình trong bảng IPA</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {phonemes.map(s => (
                      <button
                        key={s}
                        onClick={() => onSelectPhoneme(s)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-sm font-serif font-bold text-slate-700 hover:border-primary-400 hover:text-primary-600 transition-colors"
                      >
                        /{s}/
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-4 py-3 border-t border-slate-100 bg-white flex items-center justify-between">
          <button onClick={onPrev} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
            <ChevronLeft size={16} /> Trước
          </button>
          <span className="text-xs font-bold text-slate-400">{position.index + 1} / {position.total}</span>
          <button onClick={onNext} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
            Tiếp <ChevronRight size={16} />
          </button>
        </div>
      </motion.aside>
    </>
  );
};

// ---------- Map (canvas) view ----------

const MapCanvas = ({ tree, expanded, onToggle, onOpenLeaf, selectedId, recall, revealed, matchIds, oneSided, fitKey }) => {
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const dragRef = useRef(null);
  const pendingCenterRef = useRef(null);
  const [paths, setPaths] = useState([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  const edges = useMemo(() => collectEdges(tree, expanded, oneSided), [tree, expanded, oneSided]);

  // Nodes are laid out with flexbox; connectors are drawn afterwards from the measured boxes
  const measure = useCallback(() => {
    const content = contentRef.current;
    if (!content || !content.offsetWidth) return;
    const base = content.getBoundingClientRect();
    const k = base.width / content.offsetWidth || 1; // current CSS scale
    const boxes = new Map();
    content.querySelectorAll('[data-node-id]').forEach(el => {
      const r = el.getBoundingClientRect();
      boxes.set(el.dataset.nodeId, {
        left: (r.left - base.left) / k,
        right: (r.right - base.left) / k,
        midY: ((r.top + r.bottom) / 2 - base.top) / k,
      });
    });
    setPaths(edges.map(e => {
      const a = boxes.get(e.from);
      const b = boxes.get(e.to);
      if (!a || !b) return null;
      const x1 = e.side === 'left' ? a.left : a.right;
      const x2 = e.side === 'left' ? b.right : b.left;
      const mx = (x1 + x2) / 2;
      return {
        key: `${e.from}-${e.to}`,
        d: `M${x1},${a.midY} C${mx},${a.midY} ${mx},${b.midY} ${x2},${b.midY}`,
        color: e.color,
        width: e.depth === 1 ? 4 : e.depth === 2 ? 2.5 : 1.75,
      };
    }).filter(Boolean));
    setSize({ w: content.offsetWidth, h: content.offsetHeight });
  }, [edges]);

  useLayoutEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    if (!contentRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // One-sided layout starts at the root on the left, so keep it in view there
  const centerView = (alignLeft) => {
    requestAnimationFrame(() => {
      const vp = viewportRef.current;
      if (!vp) return;
      vp.scrollLeft = alignLeft ? 0 : (vp.scrollWidth - vp.clientWidth) / 2;
      vp.scrollTop = (vp.scrollHeight - vp.clientHeight) / 2;
    });
  };

  const fitToWidth = useCallback(() => {
    const vp = viewportRef.current;
    const content = contentRef.current;
    if (!vp || !content || !content.offsetWidth) return;
    const fit = Math.min(1, (vp.clientWidth - 16) / content.offsetWidth);
    // On phones a full fit makes text unreadable; stay legible and let the user pan instead
    setScale(clampScale(oneSided ? Math.max(0.6, fit) : fit));
    centerView(oneSided);
  }, [oneSided]);

  // Refit when the layout mode changes or the parent asks (expand / collapse all, search)
  useLayoutEffect(() => { fitToWidth(); }, [fitKey, fitToWidth]);

  const zoomBy = useCallback((delta) => {
    const vp = viewportRef.current;
    if (vp && vp.scrollWidth && vp.scrollHeight) {
      pendingCenterRef.current = {
        cx: (vp.scrollLeft + vp.clientWidth / 2) / vp.scrollWidth,
        cy: (vp.scrollTop + vp.clientHeight / 2) / vp.scrollHeight,
      };
    }
    setScale(s => clampScale(s + delta));
  }, []);

  // Keep the same point centred while zooming
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const p = pendingCenterRef.current;
    if (!vp || !p) return;
    vp.scrollLeft = p.cx * vp.scrollWidth - vp.clientWidth / 2;
    vp.scrollTop = p.cy * vp.scrollHeight - vp.clientHeight / 2;
    pendingCenterRef.current = null;
  }, [scale]);

  // Ctrl / ⌘ + wheel zoom (needs a non-passive listener)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 0.1 : -0.1);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  // Drag empty space to pan (mouse only; touch uses native scrolling)
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
    const vp = viewportRef.current;
    dragRef.current = { x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop };
    vp.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const vp = viewportRef.current;
    vp.scrollLeft = d.left - (e.clientX - d.x);
    vp.scrollTop = d.top - (e.clientY - d.y);
  };
  const endDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const renderNode = (node, depth, branch) => {
    if (depth === 0) {
      return (
        <div data-node-id={node.id} className="shrink-0 px-7 py-5 rounded-3xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white text-center shadow-xl shadow-primary-200">
          <div className="text-3xl mb-1">{node.emoji}</div>
          <div className="font-black text-lg leading-tight whitespace-nowrap">{node.title}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">{node.subtitle}</div>
        </div>
      );
    }

    const theme = THEMES[branch.color];
    const isOpen = expanded.has(node.id);
    const dimmed = matchIds && !subtreeHasMatch(node, matchIds) ? 'opacity-30' : '';

    if (depth === 1) {
      const leafCount = collectLeaves(node).length;
      return (
        <button
          data-node-id={node.id}
          onClick={() => onToggle(node.id)}
          aria-expanded={isOpen}
          className={`shrink-0 w-48 px-4 py-3 rounded-2xl text-left shadow-lg transition-transform hover:-translate-y-0.5 ${theme.branch} ${dimmed}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{node.emoji}</span>
            <span className="font-black text-base leading-tight flex-1">{node.title}</span>
            {!isOpen && <span className="text-[10px] font-black bg-white/25 rounded-full px-1.5 py-0.5">+{leafCount}</span>}
          </div>
          <div className="text-[11px] font-semibold opacity-90 mt-1 leading-snug">{node.subtitle}</div>
        </button>
      );
    }

    if (node.children?.length) {
      return (
        <button
          data-node-id={node.id}
          onClick={() => onToggle(node.id)}
          aria-expanded={isOpen}
          className={`shrink-0 w-44 px-3 py-2 rounded-xl border-2 text-left shadow-sm hover:shadow-md transition-shadow ${theme.group} ${dimmed}`}
        >
          <div className="flex items-center gap-1">
            <span className="font-black text-sm leading-tight flex-1">{node.title}</span>
            {!isOpen && <span className="text-[10px] font-black opacity-70">+{node.children.length}</span>}
          </div>
          <div className={`text-[11px] font-semibold opacity-80 leading-snug mt-0.5 ${isGroupHintHidden(node, recall, revealed) ? 'blur-[5px] select-none' : ''}`}>{node.hint}</div>
        </button>
      );
    }

    const hidden = recall && !revealed.has(node.id);
    const isSelected = selectedId === node.id;
    return (
      <button
        data-node-id={node.id}
        onClick={() => onOpenLeaf(node.id)}
        className={`shrink-0 w-56 px-3 py-2 rounded-xl border text-left shadow-sm hover:shadow-md transition-all ${theme.leaf} ${isSelected ? `ring-2 ring-offset-2 ${theme.ring}` : ''} ${dimmed}`}
      >
        <div className="font-bold text-sm text-slate-800 leading-tight">{node.title}</div>
        <div className={`text-[11px] font-semibold leading-snug mt-0.5 ${theme.hint} ${hidden ? 'blur-[5px] select-none' : ''}`}>{node.hint}</div>
      </button>
    );
  };

  const renderSubtree = (node, depth, branch, side) => {
    const isOpen = expanded.has(node.id);
    const kids = node.children || [];
    const kidsAreLeaves = kids.every(c => !c.children?.length);
    return (
      <div key={node.id} className={`flex items-center ${side === 'left' ? 'flex-row-reverse' : ''} ${depth === 1 ? 'gap-12' : 'gap-10'}`}>
        {renderNode(node, depth, branch)}
        {kids.length > 0 && isOpen && (
          <div className={`mm-fade flex flex-col ${kidsAreLeaves ? 'gap-2' : 'gap-4'} ${side === 'left' ? 'items-end' : 'items-start'}`}>
            {kids.map(c => renderSubtree(c, depth + 1, branch, side))}
          </div>
        )}
      </div>
    );
  };

  const leftBranches = oneSided ? [] : tree.children.filter(b => b.side === 'left');
  const rightBranches = oneSided ? tree.children : tree.children.filter(b => b.side !== 'left');

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`flex overflow-auto h-[calc(100vh-270px)] min-h-[460px] rounded-2xl sm:rounded-3xl border border-slate-200 bg-white/70 shadow-inner select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      >
        <div className="relative m-auto shrink-0 overflow-hidden" style={{ width: size.w * scale, height: size.h * scale }}>
          <div
            ref={contentRef}
            className="absolute left-0 top-0 w-max flex items-center gap-12 p-10"
            style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}
          >
            <svg className="absolute left-0 top-0 pointer-events-none" width={size.w} height={size.h}>
              {paths.map(p => (
                <path key={p.key} d={p.d} stroke={p.color} strokeWidth={p.width} strokeLinecap="round" fill="none" opacity={0.7} />
              ))}
            </svg>
            {leftBranches.length > 0 && (
              <div className="relative flex flex-col items-end gap-8">
                {leftBranches.map(b => renderSubtree(b, 1, b, 'left'))}
              </div>
            )}
            <div className="relative">{renderNode(tree, 0)}</div>
            <div className="relative flex flex-col items-start gap-8">
              {rightBranches.map(b => renderSubtree(b, 1, b, 'right'))}
            </div>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 p-1 rounded-xl bg-white/90 backdrop-blur border border-slate-200 shadow-md">
        <button onClick={() => zoomBy(-0.1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Thu nhỏ">
          <ZoomOut size={16} />
        </button>
        <span className="w-11 text-center text-xs font-bold text-slate-500">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(0.1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Phóng to">
          <ZoomIn size={16} />
        </button>
        <div className="w-px h-5 bg-slate-200 mx-0.5" />
        <button onClick={fitToWidth} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" title="Vừa khung">
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
};

// ---------- Outline (list) view ----------

const OutlineView = ({ tree, expanded, onToggle, onOpenLeaf, selectedId, recall, revealed, matchIds }) => {
  // While searching, only show the parts of the tree that contain a match
  const isVisible = (node) => !matchIds || subtreeHasMatch(node, matchIds);

  const renderItem = (node, theme) => {
    if (!isVisible(node)) return null;
    if (node.children?.length) {
      const isOpen = expanded.has(node.id);
      return (
        <div key={node.id}>
          <button
            onClick={() => onToggle(node.id)}
            aria-expanded={isOpen}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left ${theme.group}`}
          >
            <ChevronRight size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            <span className="font-black text-sm flex-1">{node.title}</span>
            <span className={`text-[11px] font-semibold opacity-80 text-right ${isGroupHintHidden(node, recall, revealed) ? 'blur-[5px] select-none' : ''}`}>{node.hint}</span>
          </button>
          {isOpen && (
            <div className={`mm-fade ml-4 pl-3 mt-2 border-l-2 space-y-2 ${theme.rail}`}>
              {node.children.map(c => renderItem(c, theme))}
            </div>
          )}
        </div>
      );
    }
    const hidden = recall && !revealed.has(node.id);
    return (
      <button
        key={node.id}
        onClick={() => onOpenLeaf(node.id)}
        className={`w-full px-3 py-2.5 rounded-xl border text-left transition-all ${theme.leaf} ${selectedId === node.id ? `ring-2 ${theme.ring}` : ''}`}
      >
        <div className="font-bold text-sm text-slate-800">{node.title}</div>
        <div className={`text-xs font-semibold mt-0.5 ${theme.hint} ${hidden ? 'blur-[5px] select-none' : ''}`}>{node.hint}</div>
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      {tree.children.filter(isVisible).map(branch => {
        const theme = THEMES[branch.color];
        const isOpen = expanded.has(branch.id);
        return (
          <div key={branch.id} className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => onToggle(branch.id)}
              aria-expanded={isOpen}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left ${theme.branch}`}
            >
              <span className="text-2xl">{branch.emoji}</span>
              <div className="flex-1">
                <div className="font-black">{branch.title}</div>
                <div className="text-xs font-semibold opacity-90">{branch.subtitle}</div>
              </div>
              <ChevronRight size={18} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            {isOpen && (
              <div className="mm-fade p-3 space-y-2">
                {branch.children.map(c => renderItem(c, theme))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------- Main view ----------

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
};

const MindmapView = ({ onSearchWord, onSelectPhoneme }) => {
  const tree = pronunciationMindmap;
  const index = useMemo(() => buildIndex(tree), [tree]);
  const leaves = useMemo(() => collectLeaves(tree), [tree]);
  const allExpandable = useMemo(() => collectExpandable(tree).filter(id => id !== tree.id), [tree]);
  const searchIndex = useMemo(() => new Map(leaves.map(l => [l.id, leafSearchText(l)])), [leaves]);

  const isNarrow = useMediaQuery('(max-width: 767px)');
  const [view, setView] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'list' : 'map'));
  // Start with the main branches open and their groups closed: the full map is too big to take in at once
  const [expanded, setExpanded] = useState(() => new Set(tree.children.map(b => b.id)));
  const [selectedId, setSelectedId] = useState(null);
  const [recall, setRecall] = useState(false);
  const [revealed, setRevealed] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [fitTick, setFitTick] = useState(0);

  const matchIds = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return null;
    return new Set(leaves.filter(l => searchIndex.get(l.id).includes(q)).map(l => l.id));
  }, [query, leaves, searchIndex]);

  // Open exactly the branches / groups that contain a match
  useEffect(() => {
    if (!matchIds) return;
    const ids = new Set();
    matchIds.forEach(id => index.get(id).trail.forEach(n => ids.add(n.id)));
    setExpanded(ids);
    setFitTick(t => t + 1);
  }, [matchIds, index]);

  const expandAll = () => {
    setExpanded(new Set(allExpandable));
    setFitTick(t => t + 1);
  };
  const collapseAll = () => {
    setExpanded(new Set());
    setFitTick(t => t + 1);
  };

  const toggle = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedIdx = leaves.findIndex(l => l.id === selectedId);
  const step = useCallback((dir) => {
    setSelectedId(cur => {
      const i = leaves.findIndex(l => l.id === cur);
      return leaves[(i + dir + leaves.length) % leaves.length].id;
    });
  }, [leaves]);

  // Make sure the selected leaf is visible when stepping through with Prev / Next
  useEffect(() => {
    if (!selectedId) return;
    const entry = index.get(selectedId);
    const ancestors = entry.trail.map(n => n.id);
    setExpanded(prev => (ancestors.every(id => prev.has(id)) ? prev : new Set([...prev, ...ancestors])));
  }, [selectedId, index]);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'Escape') setSelectedId(null);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, step]);

  const reveal = (id) => setRevealed(prev => new Set(prev).add(id));
  const revealedCount = leaves.filter(l => revealed.has(l.id)).length;

  const viewProps = {
    tree,
    expanded,
    onToggle: toggle,
    onOpenLeaf: setSelectedId,
    selectedId,
    recall,
    revealed,
    matchIds,
  };

  return (
    <section className="flex flex-col gap-4 sm:gap-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Network size={22} />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Pronunciation Mindmap</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {tree.children.length} nhánh · {leaves.length} quy tắc phiên âm, trọng âm & phát âm
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
              placeholder="Tìm: -tion, ea, câm, /ʃ/, nối âm…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex p-1 rounded-xl bg-slate-100">
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${view === 'map' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
            >
              <Network size={15} /> Sơ đồ
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${view === 'list' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500'}`}
            >
              <ListTree size={15} /> Danh sách
            </button>
          </div>
          <button
            onClick={expandAll}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300"
          >
            Mở hết
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300"
          >
            Thu gọn
          </button>
          <button
            onClick={() => setRecall(r => !r)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${recall ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
            title="Che gợi ý để tự kiểm tra trí nhớ"
          >
            {recall ? <EyeOff size={15} /> : <Eye size={15} />} Ôn tập
          </button>
        </div>
      </div>

      {recall && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-primary-50 border border-primary-100 text-sm text-primary-900">
          <span className="text-lg">🧠</span>
          <span className="flex-1 min-w-[200px]">
            <b>Chế độ ôn tập:</b> gợi ý đã bị che. Nhìn tiêu đề, tự nhớ quy tắc rồi bấm vào thẻ để lật đáp án.
          </span>
          <span className="font-black text-primary-700">Đã lật {revealedCount}/{leaves.length}</span>
          <button
            onClick={() => setRevealed(new Set())}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-primary-200 text-xs font-bold text-primary-700 hover:bg-primary-100"
          >
            <RotateCcw size={13} /> Che lại
          </button>
        </div>
      )}

      {matchIds && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-sm text-slate-600">
          <Search size={15} className="text-primary-500" />
          <span className="flex-1">
            {matchIds.size > 0
              ? <>Tìm thấy <b className="text-slate-800">{matchIds.size}</b> quy tắc khớp với "<b className="text-slate-800">{query.trim()}</b>"</>
              : <>Không có quy tắc nào khớp với "<b className="text-slate-800">{query.trim()}</b>"</>}
          </span>
          <button onClick={() => setQuery('')} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" title="Xoá tìm kiếm">
            <X size={15} />
          </button>
        </div>
      )}

      {view === 'map' ? (
        <>
          <MapCanvas {...viewProps} oneSided={isNarrow} fitKey={`${isNarrow}-${fitTick}`} />
          <p className="hidden sm:block text-xs text-slate-400 text-center -mt-1">
            Bấm nhánh để mở / thu gọn · Bấm thẻ quy tắc để xem chi tiết · Kéo nền để di chuyển · Ctrl + cuộn để phóng to
          </p>
        </>
      ) : (
        <OutlineView {...viewProps} />
      )}

      <AnimatePresence>
        {selectedId && index.get(selectedId) && (
          <DetailPanel
            key="detail"
            entry={index.get(selectedId)}
            position={{ index: selectedIdx, total: leaves.length }}
            recall={recall}
            isRevealed={revealed.has(selectedId)}
            onReveal={() => reveal(selectedId)}
            onClose={() => setSelectedId(null)}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onSearchWord={onSearchWord}
            onSelectPhoneme={onSelectPhoneme}
          />
        )}
      </AnimatePresence>
    </section>
  );
};

export default MindmapView;
