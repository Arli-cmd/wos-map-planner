import { create } from 'zustand';
import { MapObject, ToolMode, ObjectType, Alliance } from './types';
import { INITIAL_FIXED_OBJECTS } from './constants';
import { generateId } from './utils';

interface AppState {
  // Map State
  planName: string;
  objects: MapObject[];
  alliances: Alliance[];
  showLabels: boolean;
  cityCounter: number;
  
  // Editor State
  mode: ToolMode;
  selectedObjectId: string | null;
  selectedPlaceType: ObjectType | null;
  selectedAllianceId: string | null;
  
  // History
  history: MapObject[][];
  historyIndex: number;

  // Actions
  setPlanName: (name: string) => void;
  setMode: (mode: ToolMode) => void;
  setSelectedPlaceType: (type: ObjectType | null) => void;
  setSelectedAllianceId: (id: string | null) => void;
  selectObject: (id: string | null) => void;
  toggleLabels: () => void;
  addAlliance: (name: string, color: string) => void;

  // Object Mutations
  addObject: (obj: MapObject) => void;
  updateObject: (id: string, updates: Partial<MapObject>) => void;
  deleteObject: (id: string) => void;
  clearMap: () => void;

  // History Actions
  undo: () => void;
  redo: () => void;
  
  // Import/Export
  loadState: (state: Partial<AppState>) => void;
}

const pushHistory = (state: AppState, newObjects: MapObject[]) => {
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(newObjects);
  return {
    objects: newObjects,
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
};

export const useStore = create<AppState>((set, get) => ({
  planName: 'New Plan',
  objects: [...INITIAL_FIXED_OBJECTS],
  alliances: [],
  showLabels: true,
  cityCounter: 1,
  
  mode: 'select',
  selectedObjectId: null,
  selectedPlaceType: null,
  selectedAllianceId: null,
  
  history: [[...INITIAL_FIXED_OBJECTS]],
  historyIndex: 0,

  setPlanName: (name) => set({ planName: name }),
  setMode: (mode) => set((state) => ({ 
    mode, 
    selectedObjectId: null, 
    selectedPlaceType: (mode === 'place' || mode === 'draw-polygon') ? state.selectedPlaceType : null 
  })),
  setSelectedPlaceType: (type) => set({ 
    selectedPlaceType: type, 
    mode: type ? (type === 'Enemy Zone' ? 'draw-polygon' : 'place') : 'select', 
    selectedObjectId: null 
  }),
  setSelectedAllianceId: (id) => set({ selectedAllianceId: id }),
  selectObject: (id) => set({ selectedObjectId: id }),
  toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
  addAlliance: (name, color) => set((state) => ({ 
    alliances: [...state.alliances, { id: generateId(), name, color }] 
  })),

  addObject: (obj) => set((state) => {
    let nextCityCounter = state.cityCounter;
    if (obj.type === 'City') {
      nextCityCounter += 1;
    }
    return {
      ...pushHistory(state, [...state.objects, obj]),
      cityCounter: nextCityCounter
    };
  }),
  
  updateObject: (id, updates) => set((state) => {
    const newObjects = state.objects.map(o => o.id === id ? { ...o, ...updates } : o);
    return pushHistory(state, newObjects);
  }),
  
  deleteObject: (id) => set((state) => {
    const newObjects = state.objects.filter(o => o.id !== id || o.fixed);
    const citiesCount = newObjects.filter(o => o.type === 'City').length;
    return {
      ...pushHistory(state, newObjects),
      cityCounter: citiesCount === 0 ? 1 : state.cityCounter
    };
  }),
  
  clearMap: () => set((state) => ({
    ...pushHistory(state, [...INITIAL_FIXED_OBJECTS]),
    cityCounter: 1
  })),

  undo: () => set((state) => {
    if (state.historyIndex > 0) {
      return {
        historyIndex: state.historyIndex - 1,
        objects: state.history[state.historyIndex - 1],
      };
    }
    return state;
  }),
  
  redo: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
      return {
        historyIndex: state.historyIndex + 1,
        objects: state.history[state.historyIndex + 1],
      };
    }
    return state;
  }),

  loadState: (newState) => set((state) => ({
    ...state,
    ...newState,
    history: newState.objects ? [newState.objects] : state.history,
    historyIndex: 0,
  })),
}));
