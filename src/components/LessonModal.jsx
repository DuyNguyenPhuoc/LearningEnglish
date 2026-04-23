import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LessonModal = ({ isOpen, onClose, onSave, editingLesson }) => {
  const [subject, setSubject] = useState('');
  const [vocabulary, setVocabulary] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editingLesson) {
        setSubject(editingLesson.subject);
        setVocabulary(editingLesson.vocabulary);
      } else {
        setSubject('');
        setVocabulary('');
      }
    }
  }, [isOpen, editingLesson]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!subject.trim() || !vocabulary.trim()) return;

    onSave({
      id: editingLesson ? editingLesson.id : Date.now().toString(),
      subject: subject.trim(),
      vocabulary: vocabulary.trim(),
      createdAt: editingLesson ? editingLesson.createdAt : new Date().toISOString(),
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="flex items-center justify-between p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800">
              {editingLesson ? 'Edit Lesson' : 'Create New Lesson'}
            </h2>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <label htmlFor="subject" className="text-sm font-bold text-slate-700">
                Lesson Subject
              </label>
              <input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., At the Restaurant"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                required
              />
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <label htmlFor="vocabulary" className="text-sm font-bold text-slate-700">
                Vocabulary List
              </label>
              <textarea
                id="vocabulary"
                value={vocabulary}
                onChange={(e) => setVocabulary(e.target.value)}
                placeholder="Paste the words or phrases here..."
                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-500 transition-all resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!subject.trim() || !vocabulary.trim()}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                Save Lesson
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LessonModal;
