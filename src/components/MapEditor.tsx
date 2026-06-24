import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line, Text, Group, Circle, Rect, RegularPolygon } from 'react-konva';
import { useStore } from '../store';
import { MAP_SIZE, TILE_WIDTH, TILE_HEIGHT, RED_ZONE_START, RED_ZONE_END } from '../constants';
import { gridToIso, isoToGrid, isoToGridPrecise, generateId } from '../utils';
import { KonvaEventObject } from 'konva/lib/Node';
import clsx from 'clsx';

function getVisualCenter(polygon: {x: number, y: number}[]) {
  if (polygon.length === 0) return {x: 0, y: 0};
  
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  
  const isInside = (x: number, y: number) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const distToEdge = (x: number, y: number) => {
    let minDist = Infinity;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      const l2 = (xj - xi) ** 2 + (yj - yi) ** 2;
      if (l2 === 0) {
        minDist = Math.min(minDist, Math.hypot(x - xi, y - yi));
        continue;
      }
      
      let t = ((x - xi) * (xj - xi) + (y - yi) * (yj - yi)) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = xi + t * (xj - xi);
      const projY = yi + t * (yj - yi);
      minDist = Math.min(minDist, Math.hypot(x - projX, y - projY));
    }
    return minDist;
  };

  let bestPoint = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  let maxDist = -Infinity;

  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const px = minX + (maxX - minX) * (i / steps);
      const py = minY + (maxY - minY) * (j / steps);
      
      if (isInside(px, py)) {
        const d = distToEdge(px, py);
        if (d > maxDist) {
          maxDist = d;
          bestPoint = { x: px, y: py };
        }
      }
    }
  }
  
  return bestPoint;
}

const rgbToHex = (rgba: string) => {
  if (!rgba) return '#EF4444';
  if (rgba.startsWith('#')) return rgba;
  const match = rgba.match(/\d+/g);
  if (!match) return '#EF4444';
  const r = parseInt(match[0]).toString(16).padStart(2, '0');
  const g = parseInt(match[1]).toString(16).padStart(2, '0');
  const b = parseInt(match[2]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

const hexToRgba = (hex: string, alpha: number) => {
  let c = hex.substring(1);
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function getExpandedPoints(points: {x: number, y: number}[]) {
  if (!points || points.length === 0) return [];
  if (points.length < 3) return points;
  
  const N = points.length;
  
  // 1. Calculate signed area to find winding order (Shoelace formula)
  let doubleArea = 0;
  for (let i = 0; i < N; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % N];
    doubleArea += (p1.x * p2.y - p2.x * p1.y);
  }
  const isCounterClockwise = doubleArea > 0;
  
  // 2. Compute outward unit normals for all edges
  const edgeNormals: { x: number, y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % N];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    const ux = len > 0 ? dx / len : 0;
    const uy = len > 0 ? dy / len : 0;
    
    // Outward normal: (dy, -dx) for CCW, (-dy, dx) for CW
    if (isCounterClockwise) {
      edgeNormals.push({ x: uy, y: -ux });
    } else {
      edgeNormals.push({ x: -uy, y: ux });
    }
  }
  
  // 3. Compute vertex normal and select the corresponding outer corner of the cell
  return points.map((p, i) => {
    const prevNormal = edgeNormals[(i - 1 + N) % N];
    const currNormal = edgeNormals[i];
    
    const nx = (prevNormal.x + currNormal.x) / 2;
    const ny = (prevNormal.y + currNormal.y) / 2;
    
    const nlen = Math.sqrt(nx * nx + ny * ny);
    const ex = nlen > 0 ? nx / nlen : 0;
    const ey = nlen > 0 ? ny / nlen : 0;
    
    let rx = p.x;
    let ry = p.y;
    
    if (ex <= 0 && ey <= 0) {
      // Top corner
      rx = p.x;
      ry = p.y;
    } else if (ex > 0 && ey <= 0) {
      // Right corner
      rx = p.x + 1;
      ry = p.y;
    } else if (ex > 0 && ey > 0) {
      // Bottom corner
      rx = p.x + 1;
      ry = p.y + 1;
    } else if (ex <= 0 && ey > 0) {
      // Left corner
      rx = p.x;
      ry = p.y + 1;
    }
    
    return { x: rx, y: ry };
  });
}

export const MapEditor = ({ stageRef }: { stageRef: React.RefObject<any> }) => {
  const { 
    objects, mode, selectedPlaceType, showLabels, alliances, cityCounter, selectedAllianceId,
    selectObject, addObject, updateObject, deleteObject, selectedObjectId
  } = useStore();

  const [hoveredCell, setHoveredCell] = useState<{ x: number, y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<{x: number, y: number}[]>([]);
  const lastPanPos = useRef<{ x: number, y: number } | null>(null);
  const [floatingPos, setFloatingPos] = useState<{ x: number, y: number } | null>(null);

  const updateFloatingPosition = () => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const selectedObj = useStore.getState().objects.find(o => o.id === useStore.getState().selectedObjectId);
    if (selectedObj && selectedObj.type === 'Enemy Zone' && selectedObj.points) {
      const expandedPts = getExpandedPoints(selectedObj.points);
      const isoPoints = expandedPts.map(p => gridToIso(p.x, p.y));
      const visualCenter = getVisualCenter(isoPoints.map(p => ({ x: p.isoX, y: p.isoY })));
      
      const scale = stage.scaleX();
      const pos = stage.position();
      
      const screenX = visualCenter.x * scale + pos.x;
      const screenY = visualCenter.y * scale + pos.y;
      
      setFloatingPos({ x: screenX, y: screenY });
    } else {
      setFloatingPos(null);
    }
  };

  useEffect(() => {
    updateFloatingPosition();
  }, [selectedObjectId, objects]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    
    const handleStageChange = () => {
      updateFloatingPosition();
    };
    
    stage.on('xChange yChange scaleXChange scaleYChange', handleStageChange);
    return () => {
      stage.off('xChange yChange scaleXChange scaleYChange', handleStageChange);
    };
  }, [selectedObjectId, objects]);

  // Wheel to zoom
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    if (!stageRef.current) return;
    const stage = stageRef.current;
    
    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    stage.scale({ x: newScale, y: newScale });
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
  };

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || (e.evt.button === 0 && mode === 'pan')) {
      setIsPanning(true);
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
      if (stageRef.current) stageRef.current.container().style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || (e.evt.button === 0 && mode === 'pan')) {
      setIsPanning(false);
      lastPanPos.current = null;
      if (stageRef.current) stageRef.current.container().style.cursor = mode === 'pan' ? 'grab' : 'default';
    }
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    
    if (isPanning && lastPanPos.current) {
      if (e.evt.buttons === 0) {
        setIsPanning(false);
        lastPanPos.current = null;
      } else {
        const dx = e.evt.clientX - lastPanPos.current.x;
        const dy = e.evt.clientY - lastPanPos.current.y;
        stage.position({
          x: stage.x() + dx,
          y: stage.y() + dy
        });
        lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY };
        return;
      }
    }
    
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const scale = stage.scaleX();
    const x = (pointer.x - stage.x()) / scale;
    const y = (pointer.y - stage.y()) / scale;
    
    const precise = isoToGridPrecise(x, y);
    let hx = Math.floor(precise.x);
    let hy = Math.floor(precise.y);

    if (mode === 'place' && selectedPlaceType === 'City') {
      hx = Math.round(precise.x - 1);
      hy = Math.round(precise.y - 1);
    }
    
    if (hx >= 0 && hx < MAP_SIZE && hy >= 0 && hy < MAP_SIZE) {
      setHoveredCell({ x: hx, y: hy });
    } else {
      setHoveredCell(null);
    }
  };

  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    // If panning, ignore clicks
    if (e.evt.button === 1) return;

    if (e.target !== e.target.getStage() && mode !== 'place' && mode !== 'erase' && mode !== 'draw-polygon') {
       return;
    }

    if (mode === 'place' && selectedPlaceType && hoveredCell) {
      let objSize = { width: 1, height: 1 };
      let defaultColor = '#9CA3AF';
      let name = `Object`;

      if (selectedPlaceType === 'City') {
        objSize = { width: 2, height: 2 };
        defaultColor = '#10B981';
        name = `City ${cityCounter}`;
      } else if (selectedPlaceType === 'Obstacle') {
        objSize = { width: 1, height: 1 };
        defaultColor = '#5C4033'; // Dark brown
        name = `Obstacle`; // UI will hide name
      }

      // Collision check
      const isOccupied = objects.some(o => {
        if (o.type === 'Enemy Zone') return false;
        return (
          hoveredCell.x < o.position.x + o.size.width &&
          hoveredCell.x + objSize.width > o.position.x &&
          hoveredCell.y < o.position.y + o.size.height &&
          hoveredCell.y + objSize.height > o.position.y
        );
      });

      if (isOccupied) return;

      addObject({
        id: generateId(),
        type: selectedPlaceType,
        position: hoveredCell,
        size: objSize,
        name: name,
        color: defaultColor,
        allianceId: selectedPlaceType === 'City' && selectedAllianceId ? selectedAllianceId : undefined
      });
    } else if (mode === 'draw-polygon' && hoveredCell) {
      // Add point to current polygon
      const newPoints = [...polygonPoints, hoveredCell];
      setPolygonPoints(newPoints);
    } else if (mode === 'erase' && hoveredCell) {
      const objToErase = objects.find(o => {
        if (o.fixed) return false;
        if (o.type === 'Enemy Zone' && o.points) {
          return o.points.some(p => p.x === hoveredCell.x && p.y === hoveredCell.y);
        }
        return (
          hoveredCell.x >= o.position.x && hoveredCell.x < o.position.x + o.size.width &&
          hoveredCell.y >= o.position.y && hoveredCell.y < o.position.y + o.size.height
        );
      });
      if (objToErase) {
        deleteObject(objToErase.id);
      }
    } else if (mode === 'select') {
      selectObject(null);
    }
  };

  // Double click to close polygon
  const handleStageDblClick = (e: KonvaEventObject<MouseEvent>) => {
    if (mode === 'draw-polygon' && polygonPoints.length >= 3) {
      const newId = generateId();
      addObject({
        id: newId,
        type: 'Enemy Zone',
        position: polygonPoints[0],
        size: { width: 0, height: 0 },
        name: 'Enemy Territory',
        fontSize: 24,
        zoneType: 'enemy',
        color: 'rgba(239, 68, 68, 0.25)',
        strokeColor: '#EF4444',
        glowColor: '#EF4444',
        textColor: '#E2C56D',
        points: [...polygonPoints]
      });
      setPolygonPoints([]);
      selectObject(newId);
    }
  };

  // Keyboard support for polygon closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'draw-polygon' && (e.key === 'Enter' || e.key === 'Escape')) {
        if (polygonPoints.length >= 3) {
          const newId = generateId();
          addObject({
            id: newId,
            type: 'Enemy Zone',
            position: polygonPoints[0],
            size: { width: 0, height: 0 },
            name: 'Enemy Territory',
            fontSize: 24,
            zoneType: 'enemy',
            color: 'rgba(239, 68, 68, 0.25)',
            strokeColor: '#EF4444',
            glowColor: '#EF4444',
            textColor: '#E2C56D',
            points: [...polygonPoints]
          });
          selectObject(newId);
        }
        setPolygonPoints([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, polygonPoints, addObject, selectObject]);

  const handleObjectClick = (e: KonvaEventObject<any>, id: string, fixed?: boolean) => {
    if (mode === 'place' || mode === 'draw-polygon') {
      return;
    }
    e.cancelBubble = true;
    if (mode === 'erase' && !fixed) {
      deleteObject(id);
    } else if (mode === 'select') {
      selectObject(id);
    }
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    if (mode !== 'select') return;
    const node = e.target;
    const gridPos = isoToGrid(node.x(), node.y());
    
    const obj = objects.find(o => o.id === id);
    if (!obj) return;

    // Collision check
    const isOccupied = objects.some(o => {
      if (o.id === id) return false;
      return (
        gridPos.x < o.position.x + o.size.width &&
        gridPos.x + obj.size.width > o.position.x &&
        gridPos.y < o.position.y + o.size.height &&
        gridPos.y + obj.size.height > o.position.y
      );
    });

    if (isOccupied) {
       // revert to original position
       const isoPos = gridToIso(obj.position.x, obj.position.y);
       node.position({ x: isoPos.isoX, y: isoPos.isoY });
       return;
    }

    const isoPos = gridToIso(gridPos.x, gridPos.y);
    node.position({ x: isoPos.isoX, y: isoPos.isoY });
    updateObject(id, { position: gridPos });
  };

  // Arrow key panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      
      const stage = stageRef.current;
      if (!stage) return;
      
      const PAN_SPEED = 20;
      switch(e.key) {
        case 'ArrowUp': stage.y(stage.y() + PAN_SPEED); break;
        case 'ArrowDown': stage.y(stage.y() - PAN_SPEED); break;
        case 'ArrowLeft': stage.x(stage.x() + PAN_SPEED); break;
        case 'ArrowRight': stage.x(stage.x() - PAN_SPEED); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const gridLines = [];
  for (let i = 0; i <= MAP_SIZE; i++) {
    // X lines
    const startX = gridToIso(i, 0);
    const endX = gridToIso(i, MAP_SIZE);
    gridLines.push(<Line key={`x-${i}`} points={[startX.isoX, startX.isoY, endX.isoX, endX.isoY]} stroke="#374151" strokeWidth={1} opacity={0.3} />);
    
    // Y lines
    const startY = gridToIso(0, i);
    const endY = gridToIso(MAP_SIZE, i);
    gridLines.push(<Line key={`y-${i}`} points={[startY.isoX, startY.isoY, endY.isoX, endY.isoY]} stroke="#374151" strokeWidth={1} opacity={0.3} />);
  }

  const redZoneP1 = gridToIso(RED_ZONE_START, RED_ZONE_START);
  const redZoneP2 = gridToIso(RED_ZONE_END + 1, RED_ZONE_START);
  const redZoneP3 = gridToIso(RED_ZONE_END + 1, RED_ZONE_END + 1);
  const redZoneP4 = gridToIso(RED_ZONE_START, RED_ZONE_END + 1);

  const castleZoneP1 = gridToIso(25, 25);
  const castleZoneP2 = gridToIso(37, 25);
  const castleZoneP3 = gridToIso(37, 37);
  const castleZoneP4 = gridToIso(25, 37);

  const selectedObj = objects.find(o => o.id === selectedObjectId);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <Stage 
        ref={stageRef}
        width={window.innerWidth - 320}
        height={window.innerHeight - 56}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleStageClick}
        onDblClick={handleStageDblClick}
        className={mode === 'pan' || isPanning ? 'cursor-grab active:cursor-grabbing' : mode === 'place' || mode === 'draw-polygon' ? 'cursor-crosshair' : 'cursor-default'}
      >
      <Layer>
        {/* Red Zone */}
        <Line
          points={[
            redZoneP1.isoX, redZoneP1.isoY,
            redZoneP2.isoX, redZoneP2.isoY,
            redZoneP3.isoX, redZoneP3.isoY,
            redZoneP4.isoX, redZoneP4.isoY,
          ]}
          closed
          fill="rgba(155, 29, 37, 0.25)"
          stroke="rgba(155, 29, 37, 0.5)"
          strokeWidth={2}
          listening={false}
        />

        {/* Castle Zone Border (12x12) */}
        <Line
          points={[
            castleZoneP1.isoX, castleZoneP1.isoY,
            castleZoneP2.isoX, castleZoneP2.isoY,
            castleZoneP3.isoX, castleZoneP3.isoY,
            castleZoneP4.isoX, castleZoneP4.isoY,
          ]}
          closed
          stroke="rgba(155, 29, 37, 0.8)"
          strokeWidth={2}
          dash={[10, 5]}
          listening={false}
        />

        {gridLines}

        {/* Current Drawing Polygon */}
        {polygonPoints.length > 0 && (
          <Line
            points={polygonPoints.flatMap(p => [gridToIso(p.x + 0.5, p.y + 0.5).isoX, gridToIso(p.x + 0.5, p.y + 0.5).isoY])}
            stroke="red"
            strokeWidth={2}
            dash={[10, 5]}
            closed={polygonPoints.length >= 3}
          />
        )}

        {/* Objects */}
        {objects.map(obj => {
          const isSelected = selectedObjectId === obj.id;
          const alliance = obj.allianceId ? alliances.find(a => a.id === obj.allianceId) : null;
          const displayColor = alliance ? alliance.color : (obj.color || '#9CA3AF');

          if (obj.type === 'Enemy Zone' && obj.points) {
            const expandedPts = getExpandedPoints(obj.points);
            const isoPoints = expandedPts.map(p => gridToIso(p.x, p.y));
            
            const visualCenter = getVisualCenter(isoPoints.map(p => ({ x: p.isoX, y: p.isoY })));
            const pts = isoPoints.flatMap(p => [p.isoX, p.isoY]);

            const textWidth = 600;
            const textHeight = 600;

            const tFill = obj.color || (obj.zoneType === 'allied' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)');
            const tStroke = obj.strokeColor || (obj.zoneType === 'allied' ? '#3B82F6' : '#EF4444');
            const tGlow = obj.glowColor || (obj.zoneType === 'allied' ? '#3B82F6' : '#EF4444');
            const tText = obj.textColor || '#E2C56D';

            return (
              <Group
                key={obj.id}
                onClick={(e) => handleObjectClick(e, obj.id)}
                onTap={(e) => handleObjectClick(e, obj.id)}
                onMouseEnter={(e) => {
                  if (mode === 'select') {
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'pointer';
                  }
                }}
                onMouseLeave={(e) => {
                  if (mode === 'select') {
                    const stage = e.target.getStage();
                    if (stage) stage.container().style.cursor = 'default';
                  }
                }}
              >
                <Line
                  points={pts}
                  closed
                  fill={tFill}
                  stroke={isSelected ? '#ffffff' : tStroke}
                  strokeWidth={isSelected ? 3 : 2}
                  shadowColor={tGlow}
                  shadowBlur={15}
                />
                {showLabels && (
                  <Group
                    clipFunc={(ctx) => {
                      if (pts.length < 6) return;
                      ctx.beginPath();
                      ctx.moveTo(pts[0], pts[1]);
                      for (let i = 2; i < pts.length; i += 2) {
                        ctx.lineTo(pts[i], pts[i + 1]);
                      }
                      ctx.closePath();
                    }}
                    listening={false}
                  >
                    <Text
                      text={obj.name}
                      x={visualCenter.x - textWidth / 2}
                      y={visualCenter.y - textHeight / 2}
                      width={textWidth}
                      height={textHeight}
                      fill={tText}
                      fontSize={obj.fontSize || 24}
                      fontFamily="'Josefin Sans', sans-serif"
                      fontWeight="bold"
                      align="center"
                      verticalAlign="middle"
                      wrap="word"
                      shadowColor="rgba(0,0,0,0.8)"
                      shadowBlur={2}
                      shadowOffset={{ x: 1, y: 1 }}
                      shadowOpacity={1}
                      listening={false}
                    />
                  </Group>
                )}
              </Group>
            );
          }

          const isoTopLeft = gridToIso(obj.position.x, obj.position.y);
          const isCastleOrTurret = obj.type === 'Castle' || obj.type === 'Turret';
          const labelText = obj.type === 'Castle' && obj.stateName ? `${obj.name}\n(${obj.stateName})` : obj.name;

          return (
            <Group 
              key={obj.id} 
              x={isoTopLeft.isoX} 
              y={isoTopLeft.isoY}
              draggable={mode === 'select' && !obj.fixed}
              onDragEnd={(e) => handleDragEnd(e, obj.id)}
              onClick={(e) => handleObjectClick(e, obj.id, obj.fixed)}
              onTap={(e) => handleObjectClick(e, obj.id, obj.fixed)}
              onMouseEnter={(e) => {
                if (mode === 'select') {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'pointer';
                }
              }}
              onMouseLeave={(e) => {
                if (mode === 'select') {
                  const stage = e.target.getStage();
                  if (stage) stage.container().style.cursor = 'default';
                }
              }}
            >
              {/* Object Base */}
              <Line
                points={[
                  0, 0,
                  gridToIso(obj.size.width, 0).isoX, gridToIso(obj.size.width, 0).isoY,
                  gridToIso(obj.size.width, obj.size.height).isoX, gridToIso(obj.size.width, obj.size.height).isoY,
                  gridToIso(0, obj.size.height).isoX, gridToIso(0, obj.size.height).isoY,
                ]}
                closed
                fill={displayColor}
                stroke={isSelected ? '#ffffff' : (isCastleOrTurret ? '#E2C56D' : 'rgba(0,0,0,0.5)')}
                strokeWidth={isSelected ? 3 : (isCastleOrTurret ? 2 : 1)}
                shadowColor={isCastleOrTurret ? '#FFD966' : 'black'}
                shadowBlur={isCastleOrTurret ? 15 : 10}
                shadowOffset={{ x: 0, y: isCastleOrTurret ? 0 : 5 }}
                shadowOpacity={isCastleOrTurret ? 0.6 : 0.3}
              />

              {/* Labels (Hidden for Obstacles unless desired, user says "Препятствия без имени") */}
              {showLabels && obj.type !== 'Obstacle' && (
                <Text
                  text={labelText}
                  x={gridToIso(obj.size.width/2, obj.size.height/2).isoX - 100}
                  y={gridToIso(obj.size.width/2, obj.size.height/2).isoY - 50}
                  width={200}
                  height={100}
                  fill={isCastleOrTurret ? '#E2C56D' : 'white'}
                  fontSize={14}
                  fontFamily="'Josefin Sans', sans-serif"
                  fontWeight="bold"
                  align="center"
                  verticalAlign="middle"
                  wrap={obj.type === 'Castle' ? 'word' : 'none'}
                  shadowColor="rgba(0,0,0,0.8)"
                  shadowBlur={2}
                  shadowOffset={{ x: 1, y: 1 }}
                  shadowOpacity={1}
                  listening={false}
                />
              )}
            </Group>
          );
        })}

        {/* Hovered Cell Indicator - Rendered last so it's on top! */}
        {hoveredCell && (mode === 'place' || mode === 'erase' || mode === 'draw-polygon') && (
          <Line
            points={[
              gridToIso(hoveredCell.x, hoveredCell.y).isoX, gridToIso(hoveredCell.x, hoveredCell.y).isoY,
              gridToIso(hoveredCell.x + (selectedPlaceType === 'City' ? 2 : 1), hoveredCell.y).isoX, gridToIso(hoveredCell.x + (selectedPlaceType === 'City' ? 2 : 1), hoveredCell.y).isoY,
              gridToIso(hoveredCell.x + (selectedPlaceType === 'City' ? 2 : 1), hoveredCell.y + (selectedPlaceType === 'City' ? 2 : 1)).isoX, gridToIso(hoveredCell.x + (selectedPlaceType === 'City' ? 2 : 1), hoveredCell.y + (selectedPlaceType === 'City' ? 2 : 1)).isoY,
              gridToIso(hoveredCell.x, hoveredCell.y + (selectedPlaceType === 'City' ? 2 : 1)).isoX, gridToIso(hoveredCell.x, hoveredCell.y + (selectedPlaceType === 'City' ? 2 : 1)).isoY,
            ]}
            closed
            fill={mode === 'erase' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)'}
            stroke={mode === 'erase' ? 'red' : 'white'}
            strokeWidth={1}
            listening={false}
          />
        )}
      </Layer>
    </Stage>

    {selectedObj && selectedObj.type === 'Enemy Zone' && (
      <div 
        className="absolute right-4 top-4 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl p-4 w-72 z-40 text-slate-200 backdrop-blur-md transition-all duration-100 flex flex-col gap-3 pointer-events-auto"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-400">Territory Settings</span>
          <button 
            onClick={() => selectObject(null)} 
            className="text-slate-500 hover:text-white transition-colors text-[10px] bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded border border-white/5"
          >
            Close
          </button>
        </div>

        <div>
          <label className="text-[10px] uppercase text-slate-500 block mb-1.5 font-bold">Type</label>
          <div className="grid grid-cols-2 gap-2 bg-black/30 p-1 rounded-lg border border-white/5">
            <button
              onClick={() => {
                updateObject(selectedObj.id, {
                  zoneType: 'enemy',
                  name: selectedObj.name === 'Allied Territory' ? 'Enemy Territory' : selectedObj.name,
                  color: 'rgba(239, 68, 68, 0.25)',
                  strokeColor: '#EF4444',
                  glowColor: '#EF4444',
                });
              }}
              className={clsx(
                "py-1 text-xs rounded font-semibold transition-colors",
                selectedObj.zoneType === 'enemy' || !selectedObj.zoneType
                  ? "bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Enemy
            </button>
            <button
              onClick={() => {
                updateObject(selectedObj.id, {
                  zoneType: 'allied',
                  name: selectedObj.name === 'Enemy Territory' ? 'Allied Territory' : selectedObj.name,
                  color: 'rgba(59, 130, 246, 0.25)',
                  strokeColor: '#3B82F6',
                  glowColor: '#3B82F6',
                });
              }}
              className={clsx(
                "py-1 text-xs rounded font-semibold transition-colors",
                selectedObj.zoneType === 'allied'
                  ? "bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Allied
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase text-slate-500 block mb-1 font-bold">Name</label>
          <input
            type="text"
            value={selectedObj.name}
            onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
            className="bg-black/30 border border-white/10 rounded px-2 py-1 text-white text-[12px] w-full focus:outline-none focus:border-blue-500/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] uppercase text-slate-500 block mb-1 font-bold">Territory Color</label>
            <div className="flex items-center gap-2">
              <input 
                type="color"
                value={selectedObj.color ? rgbToHex(selectedObj.color) : (selectedObj.zoneType === 'allied' ? '#3B82F6' : '#EF4444')}
                onChange={(e) => {
                  const hex = e.target.value;
                  const rgba = hexToRgba(hex, 0.25);
                  updateObject(selectedObj.id, { 
                    color: rgba,
                    strokeColor: hex,
                    glowColor: hex
                  });
                }}
                className="w-8 h-8 bg-black/30 rounded border border-white/10 cursor-pointer p-0.5"
              />
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[48px]">
                {selectedObj.strokeColor || (selectedObj.zoneType === 'allied' ? '#3B82F6' : '#EF4444')}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase text-slate-500 block mb-1 font-bold">Name Color</label>
            <div className="flex items-center gap-2">
              <input 
                type="color"
                value={selectedObj.textColor || '#E2C56D'}
                onChange={(e) => updateObject(selectedObj.id, { textColor: e.target.value })}
                className="w-8 h-8 bg-black/30 rounded border border-white/10 cursor-pointer p-0.5"
              />
              <span className="text-[10px] text-slate-400 font-mono truncate max-w-[48px]">
                {selectedObj.textColor || '#E2C56D'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase text-slate-500 block mb-1 font-bold flex justify-between">
            <span>Font Size</span>
            <span className="text-slate-400">{selectedObj.fontSize || 24}px</span>
          </label>
          <input 
            type="range"
            min="12"
            max="60"
            value={selectedObj.fontSize || 24}
            onChange={(e) => updateObject(selectedObj.id, { fontSize: parseInt(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>

        <div className="border-t border-white/10 pt-2">
          <button
            onClick={() => {
              deleteObject(selectedObj.id);
              selectObject(null);
            }}
            className="w-full bg-red-950/80 hover:bg-red-900/80 border border-red-500/30 hover:border-red-500/50 text-red-200 text-xs py-1.5 rounded transition-colors"
          >
            Delete Territory
          </button>
        </div>
      </div>
    )}

    {/* Floating Legend Panel on Bottom Left */}
    <div className="absolute bottom-4 left-4 bg-slate-950/90 backdrop-blur-md border border-white/10 p-2.5 rounded-lg shadow-xl z-30 min-w-[140px] text-[11px] text-slate-300 pointer-events-auto flex flex-col gap-1.5">
      <div className="font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-1 mb-1 text-[10px]">
        Map Legend
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-[#10B981] border border-white/20"></div>
        <span>Neutral</span>
      </div>
      {alliances.map(a => (
        <div key={a.id} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border border-white/20" style={{ backgroundColor: a.color }}></div>
          <span>{a.name}</span>
        </div>
      ))}
    </div>
  </div>
  );
};
