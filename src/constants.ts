import { MapObject } from './types';

export const MAP_SIZE = 61;
export const TILE_WIDTH = 40;
export const TILE_HEIGHT = 40;

// Center coordinates
export const CENTER_X = Math.floor(MAP_SIZE / 2); // 30
export const CENTER_Y = Math.floor(MAP_SIZE / 2); // 30

// Red zone limits (28x28 centered)
// 30 - 14 + 1 = 17, 30 + 14 = 44. Size = 44 - 17 + 1 = 28.
export const RED_ZONE_START = 17;
export const RED_ZONE_END = 44;

export const INITIAL_FIXED_OBJECTS: MapObject[] = [
  {
    id: 'castle',
    type: 'Castle',
    position: { x: 28, y: 28 },
    size: { width: 6, height: 6 },
    name: 'Castle',
    color: '#3A235C', // Castle base
    fixed: true,
  },
  {
    id: 'north-turret',
    type: 'Turret',
    position: { x: 25, y: 25 },
    size: { width: 2, height: 2 },
    name: 'North\nTurret',
    color: '#5A3A8A', // Turret base
    fixed: true,
  },
  {
    id: 'south-turret',
    type: 'Turret',
    position: { x: 35, y: 35 },
    size: { width: 2, height: 2 },
    name: 'South\nTurret',
    color: '#5A3A8A',
    fixed: true,
  },
  {
    id: 'east-turret',
    type: 'Turret',
    position: { x: 35, y: 25 },
    size: { width: 2, height: 2 },
    name: 'East\nTurret',
    color: '#5A3A8A',
    fixed: true,
  },
  {
    id: 'west-turret',
    type: 'Turret',
    position: { x: 25, y: 35 },
    size: { width: 2, height: 2 },
    name: 'West\nTurret',
    color: '#5A3A8A',
    fixed: true,
  },
];

// Calculate march time: distance * factor
export const MARCH_TIME_PER_CELL_SECONDS = 15; 
