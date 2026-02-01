import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { loadDB, getActiveIPCases } from '@/lib/database';
import { IPCase } from '@/lib/types';
import { format, parseISO, isBefore, isAfter } from 'date-fns';

// Canvas and geometry constants - optimized for landscape print (fits 10" wide)
const CANVAS_W = 1100;
const CANVAS_H = 280;
const BOX_W = 52;
const BOX_H = 28;
const GAP = 4; // gap between boxes
const SECTION_GAP = 16; // gap between room sections

// Room layout matching the reference image exactly
// North hallway (top band) - B rooms on top, A rooms below for pairs
// South hallway (bottom band) - A rooms on top, B rooms below for pairs

const buildRooms = () => {
  const rooms: { id: string; x: number; y: number }[] = [];
  
  // === NORTH HALLWAY (Top Band) ===
  const northY = 40;
  let x = 50;
  
  // Section 1: 275-B/A, 276-B/A (2x2 pair)
  rooms.push({ id: '275-B', x, y: northY });
  rooms.push({ id: '276-B', x: x + BOX_W + GAP, y: northY });
  rooms.push({ id: '275-A', x, y: northY + BOX_H + GAP });
  rooms.push({ id: '276-A', x: x + BOX_W + GAP, y: northY + BOX_H + GAP });
  x += (BOX_W + GAP) * 2 + SECTION_GAP;
  
  // Section 2: 277-A, 278-A, 279-A, 280-A (single row, no B)
  rooms.push({ id: '277-A', x, y: northY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '278-A', x: x + BOX_W + GAP, y: northY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '279-A', x: x + (BOX_W + GAP) * 2, y: northY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '280-A', x: x + (BOX_W + GAP) * 3, y: northY + (BOX_H + GAP) / 2 });
  x += (BOX_W + GAP) * 4 + SECTION_GAP;
  
  // Section 3: 281-B/A, 282-B/A (2x2 pair)
  rooms.push({ id: '281-B', x, y: northY });
  rooms.push({ id: '282-B', x: x + BOX_W + GAP, y: northY });
  rooms.push({ id: '281-A', x, y: northY + BOX_H + GAP });
  rooms.push({ id: '282-A', x: x + BOX_W + GAP, y: northY + BOX_H + GAP });
  x += (BOX_W + GAP) * 2 + SECTION_GAP;
  
  // Section 4: 283-A (single room)
  rooms.push({ id: '283-A', x, y: northY + (BOX_H + GAP) / 2 });
  x += BOX_W + GAP + SECTION_GAP;
  
  // Section 5: 250-A (single room)
  rooms.push({ id: '250-A', x, y: northY + (BOX_H + GAP) / 2 });
  x += BOX_W + GAP + SECTION_GAP;
  
  // Section 6: 251-B/A, 252-B/A (2x2 pair)
  rooms.push({ id: '251-B', x, y: northY });
  rooms.push({ id: '252-B', x: x + BOX_W + GAP, y: northY });
  rooms.push({ id: '251-A', x, y: northY + BOX_H + GAP });
  rooms.push({ id: '252-A', x: x + BOX_W + GAP, y: northY + BOX_H + GAP });
  x += (BOX_W + GAP) * 2 + SECTION_GAP;
  
  // Section 7: 253-A, 254-A, 255-A, 256-A (single row)
  rooms.push({ id: '253-A', x, y: northY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '254-A', x: x + BOX_W + GAP, y: northY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '255-A', x: x + (BOX_W + GAP) * 2, y: northY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '256-A', x: x + (BOX_W + GAP) * 3, y: northY + (BOX_H + GAP) / 2 });
  x += (BOX_W + GAP) * 4 + SECTION_GAP;
  
  // Section 8: 257-B/A, 258-B/A (2x2 pair)
  rooms.push({ id: '257-B', x, y: northY });
  rooms.push({ id: '258-B', x: x + BOX_W + GAP, y: northY });
  rooms.push({ id: '257-A', x, y: northY + BOX_H + GAP });
  rooms.push({ id: '258-A', x: x + BOX_W + GAP, y: northY + BOX_H + GAP });
  
  // === SOUTH HALLWAY (Bottom Band) ===
  const southY = 170;
  x = 50;
  
  // Section 1: 274-A/B, 273-A/B (2x2 pair) - A on top, B below
  rooms.push({ id: '274-A', x, y: southY });
  rooms.push({ id: '273-A', x: x + BOX_W + GAP, y: southY });
  rooms.push({ id: '274-B', x, y: southY + BOX_H + GAP });
  rooms.push({ id: '273-B', x: x + BOX_W + GAP, y: southY + BOX_H + GAP });
  x += (BOX_W + GAP) * 2 + SECTION_GAP;
  
  // Section 2: 272-A, 271-A, 270-A, 269-A (single row)
  rooms.push({ id: '272-A', x, y: southY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '271-A', x: x + BOX_W + GAP, y: southY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '270-A', x: x + (BOX_W + GAP) * 2, y: southY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '269-A', x: x + (BOX_W + GAP) * 3, y: southY + (BOX_H + GAP) / 2 });
  x += (BOX_W + GAP) * 4 + SECTION_GAP;
  
  // Section 3: 268-A/B, 267-A/B (2x2 pair)
  rooms.push({ id: '268-A', x, y: southY });
  rooms.push({ id: '267-A', x: x + BOX_W + GAP, y: southY });
  rooms.push({ id: '268-B', x, y: southY + BOX_H + GAP });
  rooms.push({ id: '267-B', x: x + BOX_W + GAP, y: southY + BOX_H + GAP });
  x += (BOX_W + GAP) * 2 + SECTION_GAP * 3; // Extra gap for center
  
  // Section 4: 266-A/B, 265-A/B (2x2 pair)
  rooms.push({ id: '266-A', x, y: southY });
  rooms.push({ id: '265-A', x: x + BOX_W + GAP, y: southY });
  rooms.push({ id: '266-B', x, y: southY + BOX_H + GAP });
  rooms.push({ id: '265-B', x: x + BOX_W + GAP, y: southY + BOX_H + GAP });
  x += (BOX_W + GAP) * 2 + SECTION_GAP;
  
  // Section 5: 264-A, 263-A, 262-A, 261-A (single row)
  rooms.push({ id: '264-A', x, y: southY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '263-A', x: x + BOX_W + GAP, y: southY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '262-A', x: x + (BOX_W + GAP) * 2, y: southY + (BOX_H + GAP) / 2 });
  rooms.push({ id: '261-A', x: x + (BOX_W + GAP) * 3, y: southY + (BOX_H + GAP) / 2 });
  x += (BOX_W + GAP) * 4 + SECTION_GAP;
  
  // Section 6: 260-A/B, 259-A/B (2x2 pair)
  rooms.push({ id: '260-A', x, y: southY });
  rooms.push({ id: '259-A', x: x + BOX_W + GAP, y: southY });
  rooms.push({ id: '260-B', x, y: southY + BOX_H + GAP });
  rooms.push({ id: '259-B', x: x + BOX_W + GAP, y: southY + BOX_H + GAP });
  
  return rooms;
};

const ALL_ROOMS = buildRooms();

// Remap room ID based on unit (2xx -> 3xx for Unit 3, 2xx -> 4xx for Unit 4)
const remapRoomId = (roomId: string, unit: number): string => {
  if (unit === 2) return roomId;
  const newHundreds = unit.toString();
  return roomId.replace(/^2/, newHundreds);
};

// Get status color for room tile - using explicit colors for print/SVG compatibility
const getStatusColor = (status: 'empty' | 'active-ebp' | 'active-isolation' | 'active-standard' | 'occupied'): string => {
  switch (status) {
    case 'active-isolation':
      return '#ef4444'; // Red for isolation
    case 'active-ebp':
      return '#3b82f6'; // Blue for EBP (per user request)
    case 'active-standard':
      return '#22c55e'; // Green for standard precautions
    case 'occupied':
      return '#e5e7eb'; // Light gray for occupied
    case 'empty':
    default:
      return '#ffffff'; // White for empty
  }
};

interface FloorLayoutHeatmapProps {
  className?: string;
}

const FloorLayoutHeatmap = ({ className }: FloorLayoutHeatmapProps) => {
  const [selectedUnit, setSelectedUnit] = useState<'2' | '3' | '4'>('2');
  const [asOfDate, setAsOfDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  
  const db = loadDB();
  
  // Get unique units from census (only 2, 3, 4)
  const availableUnits = useMemo(() => {
    const units = new Set(
      Object.values(db.census.residentsByMrn)
        .filter(r => r.active_on_census && r.unit)
        .map(r => {
          const match = r.unit.match(/\d+/);
          return match ? match[0] : null;
        })
        .filter(u => u && ['2', '3', '4'].includes(u))
    );
    return Array.from(units).sort() as ('2' | '3' | '4')[];
  }, [db]);
  
  // Build room status map based on as-of date
  const roomStatusMap = useMemo(() => {
    const asOf = parseISO(asOfDate);
    const statusMap: Record<string, { status: string; protocol: string; infectionType: string }> = {};
    
    // Get all IP cases and filter by as-of date
    const allCases = db.records.ip_cases;
    
    allCases.forEach((ipCase: IPCase) => {
      const room = ipCase.room;
      if (!room) return;
      
      // Check if case was active on the as-of date
      // Onset <= AsOf AND (Resolution is null OR Resolution >= AsOf)
      const onsetDate = ipCase.onsetDate || ipCase.onset_date;
      const resolutionDate = ipCase.resolutionDate || ipCase.resolution_date;
      
      if (!onsetDate) return;
      
      try {
        const onset = parseISO(onsetDate);
        if (isAfter(onset, asOf)) return; // Onset after as-of date
        
        if (resolutionDate) {
          const resolution = parseISO(resolutionDate);
          if (isBefore(resolution, asOf)) return; // Resolved before as-of date
        } else {
          // No resolution date - check status
          const status = (ipCase.status || '').toLowerCase();
          if (status === 'resolved' || status === 'discharged') return;
        }
        
        // Case was active on as-of date
        statusMap[room] = {
          status: ipCase.status,
          protocol: ipCase.protocol,
          infectionType: ipCase.infectionType || ipCase.infection_type || ''
        };
      } catch {
        // Invalid date, skip
      }
    });
    
    return statusMap;
  }, [db, asOfDate]);
  
  // Get room status for a specific room ID
  const getRoomStatus = (roomId: string): 'empty' | 'active-ebp' | 'active-isolation' | 'active-standard' | 'occupied' => {
    const caseInfo = roomStatusMap[roomId];
    if (!caseInfo) {
      // Check if room is occupied by checking census
      const resident = Object.values(db.census.residentsByMrn).find(r => 
        r.room === roomId && r.active_on_census
      );
      return resident ? 'occupied' : 'empty';
    }
    
    switch (caseInfo.protocol) {
      case 'Isolation':
        return 'active-isolation';
      case 'EBP':
        return 'active-ebp';
      case 'Standard Precautions':
        return 'active-standard';
      default:
        return 'occupied';
    }
  };
  
  // Count active cases for legend
  const caseCounts = useMemo(() => {
    let isolation = 0;
    let ebp = 0;
    let standard = 0;
    
    Object.values(roomStatusMap).forEach(info => {
      switch (info.protocol) {
        case 'Isolation': isolation++; break;
        case 'EBP': ebp++; break;
        case 'Standard Precautions': standard++; break;
      }
    });
    
    return { isolation, ebp, standard };
  }, [roomStatusMap]);
  
  const handlePrint = () => {
    const svgElement = document.getElementById('floor-heatmap-svg');
    if (!svgElement) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const facility = db.settings.facilityName || 'Healthcare Facility';
    
    // Clone SVG and ensure all colors are explicit (not CSS variables)
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Floor Layout - Unit ${selectedUnit}</title>
          <style>
            @page { size: landscape; margin: 0.4in; }
            @media print {
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            body { font-family: Arial, sans-serif; margin: 0; padding: 10px; background: white; }
            .header { margin-bottom: 8px; }
            .header h1 { margin: 0; font-size: 14pt; color: #333; font-weight: bold; }
            .header p { margin: 4px 0 0 0; font-size: 10pt; color: #666; }
            .legend { display: flex; flex-wrap: wrap; gap: 12px; margin: 8px 0; font-size: 9pt; }
            .legend-item { display: flex; align-items: center; gap: 4px; }
            .legend-box { width: 12px; height: 12px; border: 1px solid #333; }
            .svg-container { width: 100%; }
            svg { width: 100%; height: auto; display: block; max-width: 10in; }
            .footer { margin-top: 12px; font-size: 8pt; color: #666; }
            .footer-line { display: flex; gap: 24px; margin-bottom: 4px; }
            .footer-field { display: flex; align-items: baseline; }
            .footer-field strong { margin-right: 4px; }
            .footer-field span { border-bottom: 1px solid #333; min-width: 120px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Unit ${selectedUnit} Floorplan</h1>
          </div>
          <div class="legend">
            <div class="legend-item"><div class="legend-box" style="background: #ef4444; border-color: #ef4444;"></div> ISO Rooms: ${caseCounts.isolation}</div>
            <div class="legend-item"><div class="legend-box" style="background: #3b82f6; border-color: #3b82f6;"></div> EBP Rooms: ${caseCounts.ebp}</div>
            <div class="legend-item"><div class="legend-box" style="background: #22c55e; border-color: #22c55e;"></div> ISO+EBP: 0</div>
            <div class="legend-item"><div class="legend-box" style="background: #f97316; border-color: #f97316;"></div> Any Precaution: ${caseCounts.isolation + caseCounts.ebp + caseCounts.standard}</div>
            <span style="margin-left: 12px;">ISO window: ${format(parseISO(asOfDate), 'yyyy-MM-dd')} (as-of) • 28d</span>
          </div>
          <div class="svg-container">
            ${svgClone.outerHTML}
          </div>
          <div class="footer">
            <div class="footer-line">
              <div class="footer-field"><strong>Isolation Precaution:</strong> <span></span></div>
            </div>
            <div class="footer-line">
              <div class="footer-field"><strong>Enhance Barrier Precaution:</strong> <span></span></div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 100);
  };
  
  const handleDownload = () => {
    const svgElement = document.getElementById('floor-heatmap-svg');
    if (!svgElement) return;
    
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `floor-layout-unit${selectedUnit}-${asOfDate}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const unitNumber = parseInt(selectedUnit);
  
  return (
    <div className={className}>
      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Unit</Label>
          <Select value={selectedUnit} onValueChange={(v) => setSelectedUnit(v as '2' | '3' | '4')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.length > 0 ? (
                availableUnits.map(u => (
                  <SelectItem key={u} value={u}>Unit {u}</SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="2">Unit 2</SelectItem>
                  <SelectItem value="3">Unit 3</SelectItem>
                  <SelectItem value="4">Unit 4</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs">Report As-of Date</Label>
          <Input 
            type="date" 
            value={asOfDate} 
            onChange={(e) => setAsOfDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            SVG
          </Button>
        </div>
      </div>
      
      {/* Legend - styled like reference with badge pills */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs items-center">
        <div className="flex items-center gap-1 px-2 py-1 rounded border border-red-500 text-red-600">
          <span className="font-medium">ISO Rooms: {caseCounts.isolation}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded border border-blue-500 text-blue-600">
          <span className="font-medium">EBP Rooms: {caseCounts.ebp}</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded border border-gray-400 text-gray-600">
          <span className="font-medium">ISO+EBP: 0</span>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded border border-green-500 text-green-600">
          <span className="font-medium">Any Precaution: {caseCounts.isolation + caseCounts.ebp + caseCounts.standard}</span>
        </div>
        <span className="text-muted-foreground ml-2">
          ISO window: {asOfDate} (as-of) • 28d
        </span>
      </div>
      
      {/* SVG Floorplan */}
      <div className="overflow-x-auto border rounded-lg bg-white p-2">
        <svg
          id="floor-heatmap-svg"
          width={CANVAS_W}
          height={CANVAS_H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="w-full max-w-[1100px]"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* Background - explicit white for print */}
          <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="#ffffff" />
          
          {/* WEST label on far left */}
          <text x="25" y="75" fontSize="12" fontWeight="bold" fill="#333333" textAnchor="middle">
            WEST
          </text>
          
          {/* EAST label on far right */}
          <text x={CANVAS_W - 25} y="75" fontSize="12" fontWeight="bold" fill="#333333" textAnchor="middle">
            EAST
          </text>
          
          {/* Room tiles */}
          {ALL_ROOMS.map(room => {
            const mappedRoomId = remapRoomId(room.id, unitNumber);
            const status = getRoomStatus(mappedRoomId);
            const fillColor = getStatusColor(status);
            // Text color based on status
            const textColor = status === 'empty' ? '#666666' : (status.startsWith('active') ? '#ffffff' : '#333333');
            
            return (
              <g key={room.id}>
                <rect
                  x={room.x}
                  y={room.y}
                  width={BOX_W}
                  height={BOX_H}
                  fill={fillColor}
                  stroke="#333333"
                  strokeWidth="1"
                />
                <text
                  x={room.x + BOX_W / 2}
                  y={room.y + BOX_H / 2 + 4}
                  fontSize="9"
                  fill={textColor}
                  textAnchor="middle"
                  fontWeight={status.startsWith('active') ? 'bold' : 'normal'}
                >
                  {mappedRoomId}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default FloorLayoutHeatmap;
