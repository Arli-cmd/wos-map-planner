import { MousePointer2, Hand, Eraser, Trash2, Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Target, Camera } from 'lucide-react';
import { useStore } from '../store';
import clsx from 'clsx';

export const Toolbar = ({ onZoomIn, onZoomOut, onReset, onCenter, onExportPNG }: any) => {
  const { mode, setMode, clearMap, undo, redo, historyIndex, history } = useStore();

  const handleTool = (m: 'select' | 'pan' | 'erase') => {
    setMode(m);
  };

  const btnClass = (active: boolean) => clsx(
    "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 border-none",
    active ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]" : "text-slate-400 bg-transparent hover:bg-white/10 hover:text-white"
  );

  return (
    <div className="h-14 bg-slate-900/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-5 z-50">
      <div className="flex items-center gap-4">
        <div className="font-black text-xl tracking-tighter text-blue-500 flex items-baseline">
          LAYOUT PLANNER <span className="text-slate-500 font-normal text-xs ml-2 tracking-normal">V1.0.4</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-2 bg-black/30 p-1 rounded-lg border border-white/5">
          <button className={btnClass(mode === 'select' || mode === 'place')} onClick={() => handleTool('select')} title="Select / Move (V)">
            <MousePointer2 size={16} /> Select
          </button>
          <button className={btnClass(mode === 'pan')} onClick={() => handleTool('pan')} title="Pan (Space)">
            <Hand size={16} /> Pan
          </button>
          <button className={btnClass(mode === 'erase')} onClick={() => handleTool('erase')} title="Erase (E)">
            <Eraser size={16} /> Erase
          </button>
        </div>

        <div className="flex gap-2 bg-black/30 p-1 rounded-lg border border-white/5">
          <button 
            className={clsx(btnClass(false), historyIndex === 0 && "opacity-50 cursor-not-allowed")} 
            onClick={undo} 
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={16} /> Undo
          </button>
          <button 
            className={clsx(btnClass(false), historyIndex === history.length - 1 && "opacity-50 cursor-not-allowed")} 
            onClick={redo} 
            title="Redo (Ctrl+Y)"
          >
            <Redo2 size={16} /> Redo
          </button>
        </div>

        <div className="flex gap-2 bg-black/30 p-1 rounded-lg border border-white/5">
          <button className={btnClass(false)} onClick={onZoomOut} title="Zoom Out">
            <ZoomOut size={16} /> Zoom -
          </button>
          <button className={btnClass(false)} onClick={onZoomIn} title="Zoom In">
            <ZoomIn size={16} /> Zoom +
          </button>
          <button className={btnClass(false)} onClick={onCenter} title="Center Castle">
            <Target size={16} /> Center
          </button>
        </div>
      </div>

      <div className="flex gap-2 bg-black/30 p-1 rounded-lg border border-white/5">
        <button className={clsx(btnClass(false), "text-amber-500 hover:bg-white/10 hover:text-amber-400")} onClick={clearMap} title="Clear Map">
          <Trash2 size={16} /> Clear All
        </button>
        <button className={btnClass(false)} onClick={onExportPNG} title="Export PNG">
          <Camera size={16} />
        </button>
      </div>
    </div>
  );
};
