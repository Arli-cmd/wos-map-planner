import React, { useRef, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { MapEditor } from './components/MapEditor';
import { useStore } from './store';
import { TILE_WIDTH, TILE_HEIGHT, MAP_SIZE } from './constants';

export default function App() {
  const stageRef = useRef<any>(null);
  const { setMode, setSelectedPlaceType, undo, redo } = useStore();

  const handleZoomIn = () => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const newScale = oldScale * 1.2;
    stage.scale({ x: newScale, y: newScale });
  };

  const handleZoomOut = () => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const oldScale = stage.scaleX();
    const newScale = oldScale / 1.2;
    stage.scale({ x: newScale, y: newScale });
  };

  const handleReset = () => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
  };

  const handleCenter = () => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    
    const scale = stage.scaleX();
    const centerX = (window.innerWidth - 320) / 2; // account for 320px sidebar
    const centerY = (window.innerHeight - 56) / 2; // account for 56px toolbar
    
    // Castle is at 28,28 size 6, center of castle is 31,31
    // Iso coords for 31,31:
    // isoX = (31 - 31) * (64/2) = 0
    // isoY = (31 + 31) * (32/2) = 62 * 16 = 992
    
    stage.position({ 
      x: centerX - 0 * scale, 
      y: centerY - 992 * scale 
    });
  };

  const handleExportPNG = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 }); // High res
    const link = document.createElement('a');
    link.download = 'map-export.png';
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    // Initial center
    setTimeout(() => {
      handleCenter();
    }, 100);

    // Check hash for shareable layout code
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#code=')) {
        const code = hash.substring(6);
        try {
          const decoded = decodeURIComponent(Array.prototype.map.call(atob(code), (c: string) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const parsed = JSON.parse(decoded);
          if (parsed && Array.isArray(parsed.objects)) {
            useStore.getState().loadState(parsed);
          }
        } catch (e) {
          console.error("Failed to load map from hash code", e);
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { mode, selectedObjectId, deleteObject, selectObject } = useStore.getState();
        if (mode === 'select' && selectedObjectId) {
          e.preventDefault();
          deleteObject(selectedObjectId);
          selectObject(null);
          return;
        }
      }

      switch (e.key) {
        case '1': setMode('select'); break;
        case '2': setMode('pan'); break;
        case '3': setMode('erase'); break;
        case '4': setSelectedPlaceType('City'); break;
        case '5': setSelectedPlaceType('Obstacle'); break;
        case '6': setSelectedPlaceType('Enemy Zone'); break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [setMode, setSelectedPlaceType, undo, redo]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-slate-200 font-sans" style={{ background: 'radial-gradient(circle at top right, #1e1b4b, #0f172a, #000000)' }}>
      <Toolbar 
        onZoomIn={handleZoomIn} 
        onZoomOut={handleZoomOut} 
        onReset={handleReset}
        onCenter={handleCenter}
        onExportPNG={handleExportPNG}
      />
      <div className="flex flex-1 relative overflow-hidden">
        <div className="flex-1 relative">
          <MapEditor stageRef={stageRef} />
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
