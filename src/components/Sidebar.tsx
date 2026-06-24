import { useStore } from '../store';
import { MapObject, ObjectType } from '../types';
import { Castle, Shield, Target, Plus, Link, Download, Upload, Copy } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', 
  '#6366F1', '#8B5CF6', '#EC4899', '#A8A29E', '#1F2937'
];

export const Sidebar = () => {
  const { 
    planName, setPlanName, objects, selectedPlaceType, setSelectedPlaceType, 
    alliances, addAlliance, selectedObjectId, updateObject, selectObject,
    showLabels, toggleLabels,
    selectedAllianceId, setSelectedAllianceId
  } = useStore();

  const [newAllianceName, setNewAllianceName] = useState('');
  const [newAllianceColor, setNewAllianceColor] = useState('#ff0000');
  const [pastedCode, setPastedCode] = useState('');

  const handleAddAlliance = () => {
    if (newAllianceName.trim()) {
      addAlliance(newAllianceName.trim(), newAllianceColor);
      setNewAllianceName('');
    }
  };

  const selectedObject = objects.find(o => o.id === selectedObjectId);

  const cities = objects.filter(o => o.type === 'City');
  
  const buildOptions: { type: ObjectType, icon: any, color: string }[] = [
    { type: 'City', icon: Castle, color: 'text-green-400' },
    { type: 'Obstacle', icon: Shield, color: 'text-yellow-600' },
    { type: 'Enemy Zone', icon: Target, color: 'text-red-400' },
  ];

  // Code layout helper
  const handleGetMapCode = () => {
    const data = { planName, objects, alliances };
    const json = JSON.stringify(data);
    const code = btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
    return code;
  };

  const handleLoadMapCode = (code: string) => {
    try {
      const decoded = decodeURIComponent(Array.prototype.map.call(atob(code.trim()), (c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const parsed = JSON.parse(decoded);
      if (parsed && Array.isArray(parsed.objects)) {
        useStore.getState().loadState(parsed);
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const handleCopyCode = () => {
    const code = handleGetMapCode();
    navigator.clipboard.writeText(code);
    alert('Plan code copied to clipboard!');
  };

  const handleLoadCode = () => {
    if (!pastedCode.trim()) {
      alert('Please paste a plan code first.');
      return;
    }
    const success = handleLoadMapCode(pastedCode);
    if (success) {
      alert('Plan code applied successfully!');
      setPastedCode('');
    } else {
      alert('Failed to apply code. Please make sure it is a valid plan code.');
    }
  };

  const handleCopyLink = () => {
    const code = handleGetMapCode();
    const url = `${window.location.origin}${window.location.pathname}#code=${code}`;
    navigator.clipboard.writeText(url);
    alert('Sharing link copied to clipboard!');
  };

  const handleExportCSV = () => {
    let csv = "Type,Name,X,Y,Width,Height,Color,Alliance,StateName,ZoneType,Points\n";
    objects.forEach(obj => {
      const ptsStr = obj.points ? obj.points.map(p => `${p.x}:${p.y}`).join(';') : '';
      const allianceName = obj.allianceId ? (alliances.find(a => a.id === obj.allianceId)?.name || '') : '';
      
      const name = `"${(obj.name || '').replace(/"/g, '""')}"`;
      const stateName = `"${(obj.stateName || '').replace(/"/g, '""')}"`;
      const type = `"${(obj.type || '').replace(/"/g, '""')}"`;
      const color = `"${(obj.color || '').replace(/"/g, '""')}"`;
      const alliance = `"${allianceName.replace(/"/g, '""')}"`;
      const zoneType = `"${(obj.zoneType || '').replace(/"/g, '""')}"`;
      
      csv += `${type},${name},${obj.position.x},${obj.position.y},${obj.size.width},${obj.size.height},${color},${alliance},${stateName},${zoneType},${ptsStr}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${planName}-layout.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n');
        if (lines.length < 2) return;
        
        const newObjects: any[] = [];
        const loadedAlliances: any[] = [...alliances];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          const values = matches.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"'));
          
          if (values.length < 6) continue;
          
          const type = values[0] as any;
          const name = values[1];
          const x = parseInt(values[2]);
          const y = parseInt(values[3]);
          const width = parseInt(values[4]);
          const height = parseInt(values[5]);
          const color = values[6] || undefined;
          const allianceName = values[7];
          const stateName = values[8] || undefined;
          const zoneType = values[9] as any || undefined;
          const ptsStr = values[10] || '';
          
          let allianceId = undefined;
          if (allianceName) {
            let existingAlliance = loadedAlliances.find(a => a.name.toLowerCase() === allianceName.toLowerCase());
            if (!existingAlliance) {
              existingAlliance = {
                id: Math.random().toString(36).substring(2, 9),
                name: allianceName,
                color: color || '#3B82F6'
              };
              loadedAlliances.push(existingAlliance);
            }
            allianceId = existingAlliance.id;
          }
          
          const points = ptsStr ? ptsStr.split(';').map(p => {
            const [px, py] = p.split(':').map(Number);
            return { x: px, y: py };
          }) : undefined;
          
          newObjects.push({
            id: Math.random().toString(36).substring(2, 9),
            type,
            name,
            position: { x, y },
            size: { width, height },
            color,
            allianceId,
            stateName,
            zoneType,
            points
          });
        }
        
        if (newObjects.length > 0) {
          useStore.getState().loadState({
            planName: planName,
            alliances: loadedAlliances,
            objects: newObjects
          });
        }
      } catch (err) {
        console.error("Error parsing CSV", err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <aside className="w-[320px] bg-slate-900/95 backdrop-blur-md border-l border-white/10 flex flex-col h-full z-50">
      <div className="p-5 flex-1 overflow-y-auto">
        <input 
          type="text" 
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-md p-2.5 text-white text-[13px] w-full mb-5 focus:outline-none focus:border-blue-500/50 transition-colors"
          placeholder="Plan Name"
        />

        <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3 font-bold mt-2">Strategic Assets</div>
        <div className="space-y-2.5 mb-5">
          {buildOptions.map(opt => {
            const Icon = opt.icon;
            const active = selectedPlaceType === opt.type;
            const displayName = opt.type === 'Enemy Zone' ? 'Territory' : opt.type;
            return (
              <div
                key={opt.type}
                onClick={() => setSelectedPlaceType(active ? null : opt.type)}
                className={clsx(
                  "bg-white/5 border rounded-lg p-3 cursor-pointer transition-all duration-200",
                  active ? "bg-white/10 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]" : "border-white/5 hover:bg-white/10 hover:border-blue-500/30"
                )}
              >
                <div className="flex justify-between items-center font-bold text-sm mb-1 text-slate-200">
                  <span className="flex items-center gap-2">
                    <Icon size={14} className={active ? (opt.type === 'City' ? "text-green-400" : "text-blue-400") : opt.color} /> 
                    {displayName}
                  </span>
                  <span className="text-blue-400 text-xs">+Add</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {opt.type === 'Enemy Zone' && "Draw Custom Polygon Area"}
                </div>
              </div>
            );
          })}
        </div>

        {selectedPlaceType === 'City' && !selectedObject && (
          <div className="mb-5 bg-black/20 p-3 rounded-lg border border-white/5">
            <label className="text-[10px] uppercase text-slate-500 block mb-1">Pre-assign Alliance for New City</label>
            <select 
              value={selectedAllianceId || ''}
              onChange={(e) => setSelectedAllianceId(e.target.value || null)}
              className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white text-[12px] w-full focus:outline-none focus:border-blue-500/50 appearance-none"
            >
              <option value="">None</option>
              {alliances.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {selectedObject && selectedObject.type !== 'Enemy Zone' && selectedObject.type !== 'Obstacle' && (selectedObject.type === 'Castle' || !selectedObject.fixed) && (
          <div className="mb-5 bg-black/20 p-3 rounded-lg border border-white/5">
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3 font-bold">Selected Object</div>
            <div className="space-y-3">
              {!selectedObject.fixed && (
                <div>
                  <label className="text-[10px] uppercase text-slate-500 block mb-1">Name</label>
                  <input 
                    type="text"
                    value={selectedObject.name}
                    onChange={(e) => updateObject(selectedObject.id, { name: e.target.value })}
                    className="bg-black/30 border border-white/10 rounded border-white/5 px-2.5 py-1.5 text-white text-[12px] w-full focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              )}
              {selectedObject.type === 'Castle' && (
                <div>
                  <label className="text-[10px] uppercase text-slate-500 block mb-1 font-bold">Battle Territory (State)</label>
                  <input 
                    type="text"
                    value={selectedObject.stateName || ''}
                    onChange={(e) => updateObject(selectedObject.id, { stateName: e.target.value })}
                    className="bg-black/30 border border-white/10 rounded border-white/5 px-2.5 py-1.5 text-white text-[12px] w-full focus:outline-none focus:border-blue-500/50"
                    placeholder="e.g. Territory of State..."
                  />
                </div>
              )}
              
              {!selectedObject.fixed && (
                <div>
                  <label className="text-[10px] uppercase text-slate-500 block mb-1">Alliance</label>
                  <select 
                    value={selectedObject.allianceId || ''}
                    onChange={(e) => updateObject(selectedObject.id, { allianceId: e.target.value || undefined })}
                    className="bg-black/30 border border-white/10 rounded border-white/5 px-2 py-1.5 text-white text-[12px] w-full focus:outline-none focus:border-blue-500/50 appearance-none"
                  >
                    <option value="">None</option>
                    {alliances.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {!selectedObject.allianceId && !selectedObject.fixed && (
                <div>
                  <label className="text-[10px] uppercase text-slate-500 block mb-2">Custom Color</label>
                  
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PRESET_COLORS.map(c => (
                      <div 
                        key={c} 
                        className={clsx(
                          "w-5 h-5 rounded cursor-pointer border", 
                          selectedObject.color === c ? "border-white" : "border-white/20"
                        )}
                        style={{ backgroundColor: c }}
                        onClick={() => updateObject(selectedObject.id, { color: c })}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="color"
                      value={selectedObject.color || '#3B82F6'}
                      onChange={(e) => updateObject(selectedObject.id, { color: e.target.value })}
                      className="w-8 h-8 bg-black/30 rounded border border-white/10 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={selectedObject.color || '#3B82F6'}
                      onChange={(e) => updateObject(selectedObject.id, { color: e.target.value })}
                      className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white text-[12px] flex-1 focus:outline-none focus:border-blue-500/50"
                      placeholder="#HEX"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 mb-4">
          <span className="text-xs font-bold text-slate-300">Show Labels</span>
          <div className={clsx("w-8 h-4 rounded-full relative transition-colors duration-200", showLabels ? "bg-blue-500" : "bg-slate-800")} onClick={toggleLabels}>
            <div className={clsx("w-3 h-3 bg-white rounded-full absolute top-[2px] transition-all duration-200", showLabels ? "right-[2px]" : "left-[2px]")}></div>
          </div>
        </div>
        
        {selectedPlaceType === 'City' && !selectedObject && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="text-[11px] uppercase tracking-widest text-slate-500 mb-3 font-bold mt-2">Manage Alliances</div>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newAllianceName}
                  onChange={(e) => setNewAllianceName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 bg-black/30 border border-white/10 rounded-md p-2 text-white text-[12px] focus:outline-none focus:border-blue-500/50 transition-colors"
                />
                <button onClick={handleAddAlliance} className="bg-white/5 hover:bg-white/10 border border-white/5 px-3 rounded-md transition-colors text-slate-300 flex justify-center items-center">
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <div 
                      key={c} 
                      className={clsx(
                        "w-4 h-4 rounded cursor-pointer border", 
                        newAllianceColor === c ? "border-white" : "border-white/20"
                      )}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewAllianceColor(c)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="color"
                    value={newAllianceColor}
                    onChange={(e) => setNewAllianceColor(e.target.value)}
                    className="w-8 h-8 bg-black/30 rounded border border-white/10 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={newAllianceColor}
                    onChange={(e) => setNewAllianceColor(e.target.value)}
                    className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white text-[12px] flex-1 focus:outline-none focus:border-blue-500/50"
                    placeholder="#HEX"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              {alliances.map(a => (
                <div key={a.id} className="flex items-center gap-2 text-xs text-white">
                  <div className="w-4 h-4 rounded border border-white/20" style={{ backgroundColor: a.color }}></div>
                  <span>{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 pt-5 border-t border-white/10">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Manage Cities</span>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
              Total: {cities.length}
            </span>
          </div>
          <div className="space-y-2">
            {cities.map(city => (
              <div key={city.id} className={clsx("flex items-center gap-2 p-2 rounded bg-black/20 border cursor-pointer", selectedObjectId === city.id ? "border-blue-500/50" : "border-white/5")} onClick={() => selectObject(city.id)}>
                <input 
                  type="text"
                  value={city.name}
                  onChange={(e) => updateObject(city.id, { name: e.target.value })}
                  className="bg-black/30 border border-white/10 rounded px-2 py-1 text-white text-[11px] w-24 focus:outline-none focus:border-blue-500/50"
                  onClick={e => e.stopPropagation()}
                />
                <select 
                  value={city.allianceId || ''}
                  onChange={(e) => updateObject(city.id, { allianceId: e.target.value || undefined })}
                  className="bg-black/30 border border-white/10 rounded px-1 py-1 text-white text-[11px] flex-1 focus:outline-none focus:border-blue-500/50 appearance-none"
                  onClick={e => e.stopPropagation()}
                >
                  <option value="">No Alliance</option>
                  {alliances.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            ))}
            {cities.length === 0 && <div className="text-xs text-slate-500 italic">No cities built yet.</div>}
          </div>
        </div>

      </div>

      <div className="p-4 border-t border-white/10 bg-slate-900/50 flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Share & Data</div>
        
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={handleCopyLink} 
            className="col-span-2 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-bold py-2 px-3 rounded-md transition-all shadow-[0_0_10px_rgba(59,130,246,0.3)] border border-blue-400/20"
          >
            <Link size={14} /> Copy Sharing Link
          </button>
          
          <button 
            onClick={handleExportCSV} 
            className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-semibold py-1.5 px-2 rounded-md transition-colors border border-white/5"
          >
            <Download size={13} /> Export CSV
          </button>
          
          <label className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-semibold py-1.5 px-2 rounded-md transition-colors border border-white/5 text-center cursor-pointer">
            <Upload size={13} /> Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          </label>
        </div>

        <div className="bg-black/35 p-2.5 rounded border border-white/5 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Plan Code</span>
            <button 
              onClick={handleCopyCode} 
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors font-bold flex items-center gap-1"
            >
              <Copy size={11} /> Copy Code
            </button>
          </div>
          
          <textarea
            value={pastedCode}
            onChange={(e) => setPastedCode(e.target.value)}
            placeholder="Paste Plan Code here to restore layout..."
            className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-blue-500/50 resize-none h-14"
          />
          
          <button 
            onClick={handleLoadCode} 
            className="w-full bg-white/5 hover:bg-white/10 text-white text-[11px] font-bold py-1 rounded transition-colors border border-white/5"
          >
            Apply Plan Code
          </button>
        </div>
      </div>
    </aside>
  );
};
