// Hard-coded floor layout matching the reference image exactly
// All rooms use Unit 2 numbering (2xx). For units 3/4, replace first digit.

export interface RoomPosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Constants
export const BOX_W = 70;
export const BOX_H = 32;
export const GAP = 4;

// North Hallway - Top band
// Reading left to right from reference image
const NORTH_Y_TOP = 40;
const NORTH_Y_BOT = NORTH_Y_TOP + BOX_H + GAP;

// South Hallway - Bottom band
const SOUTH_Y_TOP = 160;
const SOUTH_Y_BOT = SOUTH_Y_TOP + BOX_H + GAP;

// Build rooms matching exact reference layout
export const FLOOR_LAYOUT: RoomPosition[] = [
  // ========== NORTH HALLWAY (Top Band) ==========
  
  // Section 1: 275-B/A, 276-B/A (2x2)
  { id: '275-B', x: 60, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '276-B', x: 60 + BOX_W + GAP, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '275-A', x: 60, y: NORTH_Y_BOT, w: BOX_W, h: BOX_H },
  { id: '276-A', x: 60 + BOX_W + GAP, y: NORTH_Y_BOT, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 2: 277-A, 278-A, 279-A, 280-A (single row)
  { id: '277-A', x: 230, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '278-A', x: 230 + (BOX_W + GAP), y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '279-A', x: 230 + (BOX_W + GAP) * 2, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '280-A', x: 230 + (BOX_W + GAP) * 3, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 3: 281-B/A, 282-B/A (2x2)
  { id: '281-B', x: 545, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '282-B', x: 545 + BOX_W + GAP, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '281-A', x: 545, y: NORTH_Y_BOT, w: BOX_W, h: BOX_H },
  { id: '282-A', x: 545 + BOX_W + GAP, y: NORTH_Y_BOT, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 4: 283-A, 250-A (single row)
  { id: '283-A', x: 715, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '250-A', x: 715 + BOX_W + GAP, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 5: 251-B/A, 252-B/A (2x2)
  { id: '251-B', x: 885, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '252-B', x: 885 + BOX_W + GAP, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '251-A', x: 885, y: NORTH_Y_BOT, w: BOX_W, h: BOX_H },
  { id: '252-A', x: 885 + BOX_W + GAP, y: NORTH_Y_BOT, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 6: 253-A, 254-A, 255-A, 256-A (single row)
  { id: '253-A', x: 1055, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '254-A', x: 1055 + (BOX_W + GAP), y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '255-A', x: 1055 + (BOX_W + GAP) * 2, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '256-A', x: 1055 + (BOX_W + GAP) * 3, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 7: 257-B/A, 258-B/A (2x2)
  { id: '257-B', x: 1370, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '258-B', x: 1370 + BOX_W + GAP, y: NORTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '257-A', x: 1370, y: NORTH_Y_BOT, w: BOX_W, h: BOX_H },
  { id: '258-A', x: 1370 + BOX_W + GAP, y: NORTH_Y_BOT, w: BOX_W, h: BOX_H },
  
  // ========== SOUTH HALLWAY (Bottom Band) ==========
  
  // Section 1: 274-A/B, 273-A/B (2x2) - A on top
  { id: '274-A', x: 60, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '273-A', x: 60 + BOX_W + GAP, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '274-B', x: 60, y: SOUTH_Y_BOT, w: BOX_W, h: BOX_H },
  { id: '273-B', x: 60 + BOX_W + GAP, y: SOUTH_Y_BOT, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 2: 272-A, 271-A, 270-A, 269-A (single row)
  { id: '272-A', x: 230, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '271-A', x: 230 + (BOX_W + GAP), y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '270-A', x: 230 + (BOX_W + GAP) * 2, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '269-A', x: 230 + (BOX_W + GAP) * 3, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 3: 268-A/B, 267-A/B (2x2)
  { id: '268-A', x: 545, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '267-A', x: 545 + BOX_W + GAP, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '268-B', x: 545, y: SOUTH_Y_BOT, w: BOX_W, h: BOX_H },
  { id: '267-B', x: 545 + BOX_W + GAP, y: SOUTH_Y_BOT, w: BOX_W, h: BOX_H },
  
  // Large gap for nurses station, then Section 4: 266-A/B, 265-A/B (2x2)
  { id: '266-A', x: 885, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '265-A', x: 885 + BOX_W + GAP, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '266-B', x: 885, y: SOUTH_Y_BOT, w: BOX_W, h: BOX_H },
  { id: '265-B', x: 885 + BOX_W + GAP, y: SOUTH_Y_BOT, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 5: 264-A, 263-A, 262-A, 261-A (single row)
  { id: '264-A', x: 1055, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '263-A', x: 1055 + (BOX_W + GAP), y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '262-A', x: 1055 + (BOX_W + GAP) * 2, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '261-A', x: 1055 + (BOX_W + GAP) * 3, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  
  // Gap, then Section 6: 260-A/B, 259-A/B (2x2)
  { id: '260-A', x: 1370, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '259-A', x: 1370 + BOX_W + GAP, y: SOUTH_Y_TOP, w: BOX_W, h: BOX_H },
  { id: '260-B', x: 1370, y: SOUTH_Y_BOT, w: BOX_W, h: BOX_H },
  { id: '259-B', x: 1370 + BOX_W + GAP, y: SOUTH_Y_BOT, w: BOX_W, h: BOX_H },
];

// Canvas dimensions
export const CANVAS_WIDTH = 1550;
export const CANVAS_HEIGHT = 280;

// Remap room ID based on unit (2xx -> 3xx for Unit 3, 2xx -> 4xx for Unit 4)
export const remapRoomId = (roomId: string, unit: number): string => {
  if (unit === 2) return roomId;
  const newHundreds = unit.toString();
  return roomId.replace(/^2/, newHundreds);
};

// Status colors - explicit hex for print compatibility
export type RoomStatus = 'empty' | 'active-ebp' | 'active-isolation' | 'active-standard' | 'occupied';

export const getStatusColor = (status: RoomStatus): string => {
  switch (status) {
    case 'active-isolation':
      return '#ef4444'; // Red
    case 'active-ebp':
      return '#3b82f6'; // Blue
    case 'active-standard':
      return '#22c55e'; // Green
    case 'occupied':
      return '#e5e7eb'; // Light gray
    case 'empty':
    default:
      return '#ffffff'; // White
  }
};

export const getTextColor = (status: RoomStatus): string => {
  switch (status) {
    case 'active-isolation':
    case 'active-ebp':
    case 'active-standard':
      return '#ffffff';
    case 'occupied':
      return '#333333';
    case 'empty':
    default:
      return '#666666';
  }
};
