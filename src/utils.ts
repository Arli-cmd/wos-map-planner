import { TILE_WIDTH, TILE_HEIGHT } from './constants';
import { GridPosition } from './types';

// Convert grid (col, row) to isometric pixel coordinates (x, y)
export const gridToIso = (x: number, y: number) => {
  return {
    isoX: (x - y) * (TILE_WIDTH / 2),
    isoY: (x + y) * (TILE_HEIGHT / 2)
  };
};

// Convert isometric pixel coordinates (x, y) to precise grid float coordinates
export const isoToGridPrecise = (isoX: number, isoY: number) => {
  const w2 = TILE_WIDTH / 2;
  const h2 = TILE_HEIGHT / 2;
  
  const x = (isoY / h2 + isoX / w2) / 2;
  const y = (isoY / h2 - isoX / w2) / 2;
  
  return { x, y };
};

// Convert isometric pixel coordinates (x, y) to nearest grid vertex
export const isoToGrid = (isoX: number, isoY: number): GridPosition => {
  const precise = isoToGridPrecise(isoX, isoY);
  return { 
    x: Math.round(precise.x), 
    y: Math.round(precise.y) 
  };
};

// Generate an ID
export const generateId = () => Math.random().toString(36).substring(2, 9);
