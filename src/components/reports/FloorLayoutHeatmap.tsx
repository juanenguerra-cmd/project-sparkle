import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { loadDB, getActiveIPCases } from '@/lib/database';
import { IPCase } from '@/lib/types';
import { format, parseISO, isBefore, isAfter } from 'date-fns';

// Canvas and geometry constants (per spec)
const CANVAS_W = 1400;
const CANVAS_H = 420;
const BOX_W = 64;
const BOX_H = 40;
const DX = BOX_W + 2;
const DY = BOX_H + 2;

// Room inventory with exact coordinates (2xx master set)
// WEST — Top band
const WEST_TOP_ROOMS = [
  { id: '275-B', x: 50, y: 40 },
  { id: '276-B', x: 50 + DX, y: 40 },
  { id: '275-A', x: 50, y: 40 + DY },
  { id: '276-A', x: 50 + DX, y: 40 + DY },
  { id: '277-A', x: 50 + DX * 2.5, y: 40 + DY / 2 },
  { id: '278-A', x: 50 + DX * 3.5, y: 40 + DY / 2 },
  { id: '279-A', x: 50 + DX * 4.5, y: 40 + DY / 2 },
  { id: '280-A', x: 50 + DX * 5.5, y: 40 + DY / 2 },
  { id: '281-B', x: 50 + DX * 7, y: 40 },
  { id: '282-B', x: 50 + DX * 8, y: 40 },
  { id: '281-A', x: 50 + DX * 7, y: 40 + DY },
  { id: '282-A', x: 50 + DX * 8, y: 40 + DY },
  { id: '283-A', x: 50 + DX * 9.5, y: 40 + DY / 2 },
];

// EAST — Top band
const EAST_TOP_ROOMS = [
  { id: '250-A', x: 750, y: 40 + DY / 2 },
  { id: '251-B', x: 750 + DX * 1.5, y: 40 },
  { id: '252-B', x: 750 + DX * 2.5, y: 40 },
  { id: '251-A', x: 750 + DX * 1.5, y: 40 + DY },
  { id: '252-A', x: 750 + DX * 2.5, y: 40 + DY },
  { id: '253-A', x: 750 + DX * 4, y: 40 + DY / 2 },
  { id: '254-A', x: 750 + DX * 5, y: 40 + DY / 2 },
  { id: '255-A', x: 750 + DX * 6, y: 40 + DY / 2 },
  { id: '256-A', x: 750 + DX * 7, y: 40 + DY / 2 },
  { id: '257-B', x: 750 + DX * 8.5, y: 40 },
  { id: '258-B', x: 750 + DX * 9.5, y: 40 },
  { id: '257-A', x: 750 + DX * 8.5, y: 40 + DY },
  { id: '258-A', x: 750 + DX * 9.5, y: 40 + DY },
];

// WEST — Bottom band
const WEST_BOTTOM_ROOMS = [
  { id: '274-A', x: 50, y: 210 },
  { id: '273-A', x: 50 + DX, y: 210 },
  { id: '274-B', x: 50, y: 210 + DY },
  { id: '273-B', x: 50 + DX, y: 210 + DY },
  { id: '272-A', x: 50 + DX * 2.5, y: 210 + DY / 2 },
  { id: '271-A', x: 50 + DX * 3.5, y: 210 + DY / 2 },
  { id: '270-A', x: 50 + DX * 4.5, y: 210 + DY / 2 },
  { id: '269-A', x: 50 + DX * 5.5, y: 210 + DY / 2 },
  { id: '268-A', x: 50 + DX * 7, y: 210 },
  { id: '267-A', x: 50 + DX * 8, y: 210 },
  { id: '268-B', x: 50 + DX * 7, y: 210 + DY },
  { id: '267-B', x: 50 + DX * 8, y: 210 + DY },
];

// EAST — Bottom band
const EAST_BOTTOM_ROOMS = [
  { id: '266-A', x: 750, y: 210 },
  { id: '265-A', x: 750 + DX, y: 210 },
  { id: '266-B', x: 750, y: 210 + DY },
  { id: '265-B', x: 750 + DX, y: 210 + DY },
  { id: '264-A', x: 750 + DX * 2.5, y: 210 + DY / 2 },
  { id: '263-A', x: 750 + DX * 3.5, y: 210 + DY / 2 },
  { id: '262-A', x: 750 + DX * 4.5, y: 210 + DY / 2 },
  { id: '261-A', x: 750 + DX * 5.5, y: 210 + DY / 2 },
  { id: '260-A', x: 750 + DX * 7, y: 210 },
  { id: '259-A', x: 750 + DX * 8, y: 210 },
  { id: '260-B', x: 750 + DX * 7, y: 210 + DY },
  { id: '259-B', x: 750 + DX * 8, y: 210 + DY },
];

const ALL_ROOMS = [
  ...WEST_TOP_ROOMS,
  ...EAST_TOP_ROOMS,
  ...WEST_BOTTOM_ROOMS,
  ...EAST_BOTTOM_ROOMS,
];

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
            @page { size: landscape; margin: 0.5in; }
            @media print {
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: white; }
            .header { text-align: center; margin-bottom: 15px; }
            .header h1 { margin: 0; font-size: 16pt; color: #333; }
            .header p { margin: 5px 0; font-size: 10pt; color: #666; }
            .legend { display: flex; justify-content: center; gap: 20px; margin: 10px 0; font-size: 9pt; }
            .legend-item { display: flex; align-items: center; gap: 5px; }
            .legend-box { width: 14px; height: 14px; border: 1px solid #333; }
            .svg-container { width: 100%; max-width: 10in; margin: 0 auto; }
            svg { width: 100%; height: auto; display: block; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${facility}</h1>
            <p>Floor Layout Heatmap - Unit ${selectedUnit} | As of ${format(parseISO(asOfDate), 'MM/dd/yyyy')}</p>
          </div>
          <div class="legend">
            <div class="legend-item"><div class="legend-box" style="background: #ef4444;"></div> Isolation (${caseCounts.isolation})</div>
            <div class="legend-item"><div class="legend-box" style="background: #3b82f6;"></div> EBP (${caseCounts.ebp})</div>
            <div class="legend-item"><div class="legend-box" style="background: #22c55e;"></div> Standard (${caseCounts.standard})</div>
            <div class="legend-item"><div class="legend-box" style="background: #e5e7eb;"></div> Occupied</div>
            <div class="legend-item"><div class="legend-box" style="background: #fff; border: 1px solid #ccc;"></div> Empty</div>
          </div>
          <div class="svg-container">
            ${svgClone.outerHTML}
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
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#ef4444' }} />
          <span>Isolation ({caseCounts.isolation})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#3b82f6' }} />
          <span>EBP ({caseCounts.ebp})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#22c55e' }} />
          <span>Standard ({caseCounts.standard})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#e5e7eb' }} />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border" style={{ backgroundColor: '#ffffff', borderColor: '#ccc' }} />
          <span>Empty</span>
        </div>
      </div>
      
      {/* SVG Floorplan */}
      <div className="overflow-x-auto border rounded-lg bg-white p-2">
        <svg
          id="floor-heatmap-svg"
          width={CANVAS_W}
          height={CANVAS_H}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="min-w-[800px]"
          style={{ backgroundColor: '#ffffff' }}
        >
          {/* Background - explicit white for print */}
          <rect x="0" y="0" width={CANVAS_W} height={CANVAS_H} fill="#ffffff" />
          
          {/* Hallway labels */}
          <text x="350" y="25" fontSize="14" fontWeight="bold" fill="#333333" textAnchor="middle">
            WEST HALLWAY
          </text>
          <text x="1050" y="25" fontSize="14" fontWeight="bold" fill="#333333" textAnchor="middle">
            EAST HALLWAY
          </text>
          
          {/* Center divider */}
          <line x1={CANVAS_W / 2} y1="30" x2={CANVAS_W / 2} y2={CANVAS_H - 30} stroke="#cccccc" strokeWidth="2" strokeDasharray="5,5" />
          
          {/* Hallway lines */}
          <line x1="40" y1="170" x2="660" y2="170" stroke="#cccccc" strokeWidth="1" />
          <line x1="740" y1="170" x2="1360" y2="170" stroke="#cccccc" strokeWidth="1" />
          <line x1="40" y1="380" x2="660" y2="380" stroke="#cccccc" strokeWidth="1" />
          <line x1="740" y1="380" x2="1360" y2="380" stroke="#cccccc" strokeWidth="1" />
          
          {/* Room tiles */}
          {ALL_ROOMS.map(room => {
            const mappedRoomId = remapRoomId(room.id, unitNumber);
            const status = getRoomStatus(mappedRoomId);
            const fillColor = getStatusColor(status);
            // Text color based on status
            const textColor = status === 'empty' ? '#999999' : (status.startsWith('active') ? '#ffffff' : '#333333');
            
            return (
              <g key={room.id}>
                <rect
                  x={room.x}
                  y={room.y}
                  width={BOX_W}
                  height={BOX_H}
                  fill={fillColor}
                  stroke="#999999"
                  strokeWidth="1"
                  rx="3"
                />
                <text
                  x={room.x + BOX_W / 2}
                  y={room.y + BOX_H / 2 + 4}
                  fontSize="10"
                  fill={textColor}
                  textAnchor="middle"
                  fontWeight={status.startsWith('active') ? 'bold' : 'normal'}
                >
                  {mappedRoomId}
                </text>
              </g>
            );
          })}
          
          {/* Unit label */}
          <text x={CANVAS_W / 2} y={CANVAS_H - 10} fontSize="12" fill="#666666" textAnchor="middle">
            Unit {selectedUnit} — As of {format(parseISO(asOfDate), 'MM/dd/yyyy')}
          </text>
        </svg>
      </div>
    </div>
  );
};

export default FloorLayoutHeatmap;
