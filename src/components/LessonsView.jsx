import React from 'react';
import { BookOpen, Plus, Clock, Play, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LessonsView = ({ lessons, onAdd, onEdit, onDelete, onStudy }) => {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800">
          <BookOpen size={24} className="text-primary-500" />
          <h2 className="text-xl font-bold">My Lessons</h2>
        </div>
        <button 
          onClick={onAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Add New Lesson</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {lessons.length > 0 ? (
            lessons.map((lesson) => (
              <motion.div
                key={lesson.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass-card p-6 rounded-3xl flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg mb-2 line-clamp-2">{lesson.subject}</h3>
                  <p className="text-sm text-slate-500 line-clamp-3 mb-4">
                    {lesson.vocabulary}
                  </p>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                    <Clock size={14} />
                    {new Date(lesson.createdAt).toLocaleDateString()}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onStudy(lesson)}
                      className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center hover:bg-primary-100 hover:scale-110 transition-all"
                      title="Study this lesson"
                    >
                      <Play size={14} className="ml-0.5" />
                    </button>
                    <button 
                      onClick={() => onEdit(lesson)}
                      className="w-8 h-8 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center hover:bg-slate-100 hover:scale-110 transition-all"
                      title="Edit lesson"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => onDelete(lesson.id)}
                      className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 hover:scale-110 transition-all"
                      title="Delete lesson"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full h-80 flex flex-col items-center justify-center text-center opacity-50"
            >
              <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                <BookOpen size={40} className="text-slate-400" />
              </div>
              <p className="text-slate-600 font-bold text-lg">No lessons found.</p>
              <p className="text-sm text-slate-500 max-w-xs mt-2">Create your first lesson to start storing and practicing vocabulary.</p>
              <button 
                onClick={onAdd}
                className="mt-6 text-primary-600 font-semibold text-sm hover:underline"
              >
                Create your first lesson
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default LessonsView;
