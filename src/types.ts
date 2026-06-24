export type ToolMode = 'select' | 'pan' | 'erase' | 'place' | 'draw-polygon';

export type ObjectType = 'City' | 'Obstacle' | 'Enemy Zone' | 'Castle' | 'Turret';

export interface GridPosition {
  x: number;
  y: number;
}

export interface Alliance {
  id: string;
  name: string;
  color: string;
}

export interface MapObject {
  id: string;
  type: ObjectType;
  position: GridPosition;
  size: { width: number; height: number };
  name: string;
  fontSize?: number;
  color?: string;
  allianceId?: string;
  fixed?: boolean;
  points?: GridPosition[]; // For Enemy Zone polygons
  stateName?: string;      // Castle's state territory name
  zoneType?: 'enemy' | 'allied'; // Territory type
  strokeColor?: string;    // Custom border color
  glowColor?: string;      // Custom glow color
  textColor?: string;      // Custom text color
}

export interface MapState {
  objects: MapObject[];
  planName: string;
  alliances: Alliance[];
  showLabels: boolean;
  cityCounter: number;
}
