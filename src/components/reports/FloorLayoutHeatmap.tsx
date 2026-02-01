import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { loadDB } from '@/lib/database';
import { IPCase } from '@/lib/types';
import { format, parseISO, isBefore, isAfter } from 'date-fns';
import {
  FLOOR_LAYOUT,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  remapRoomId,
  getStatusColor,
  getTextColor,
  RoomStatus
} from './floorLayoutData';

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
    
    const allCases = db.records.ip_cases;
    
    allCases.forEach((ipCase: IPCase) => {
      const room = ipCase.room;
      if (!room) return;
      
      const onsetDate = ipCase.onsetDate || ipCase.onset_date;
      const resolutionDate = ipCase.resolutionDate || ipCase.resolution_date;
      
      if (!onsetDate) return;
      
      try {
        const onset = parseISO(onsetDate);
        if (isAfter(onset, asOf)) return;
        
        if (resolutionDate) {
          const resolution = parseISO(resolutionDate);
          if (isBefore(resolution, asOf)) return;
        } else {
          const status = (ipCase.status || '').toLowerCase();
          if (status === 'resolved' || status === 'discharged') return;
        }
        
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
  const getRoomStatus = (roomId: string): RoomStatus => {
    const caseInfo = roomStatusMap[roomId];
    if (!caseInfo) {
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
    
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Floor Layout - Unit ${selectedUnit}</title>
          <style>
            @page { size: landscape; margin: 0.3in 0.4in; }
            @media print {
              body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            }
            * { box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 0; 
              background: white;
            }
            .container {
              width: 100%;
              max-width: 10in;
              margin: 0 auto;
            }
            .header { margin-bottom: 8px; }
            .header h1 { margin: 0; font-size: 14pt; color: #333; font-weight: bold; }
            .legend { 
              display: flex; 
              flex-wrap: wrap; 
              gap: 12px; 
              margin: 8px 0; 
              font-size: 9pt; 
              align-items: center;
            }
            .legend-item { 
              display: inline-flex; 
              align-items: center; 
              gap: 4px; 
              padding: 3px 8px;
              border: 1px solid;
              border-radius: 4px;
              font-weight: 500;
            }
            .svg-container { 
              width: 100%; 
              overflow: hidden;
            }
            svg { 
              width: 100%; 
              height: auto; 
              display: block;
            }
            .footer { margin-top: 12px; font-size: 9pt; color: #c00; }
            .footer-line { margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Unit ${selectedUnit} Floorplan</h1>
            </div>
            <div class="legend">
              <div class="legend-item" style="border-color: #f97316; color: #f97316;">ISO Rooms: ${caseCounts.isolation}</div>
              <div class="legend-item" style="border-color: #3b82f6; color: #3b82f6;">EBP Rooms: ${caseCounts.ebp}</div>
              <div class="legend-item" style="border-color: #666; color: #666;">ISO+EBP: 0</div>
              <div class="legend-item" style="border-color: #22c55e; color: #22c55e;">Any Precaution: ${caseCounts.isolation + caseCounts.ebp + caseCounts.standard}</div>
              <span style="color: #666; margin-left: 10px;">ISO window: ${format(parseISO(asOfDate), 'yyyy-MM-dd')} (as-of) • 28d</span>
            </div>
            <div class="svg-container">
              ${svgClone.outerHTML}
            </div>
            <div class="footer">
              <div class="footer-line"><strong>Isolation Precaution:</strong> —</div>
              <div class="footer-line"><strong>Enhance Barrier Precaution:</strong> —</div>
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
      
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs items-center">
        <div className="flex items-center gap-1 px-2 py-1 rounded border border-orange-500 text-orange-600">
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
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto"
          style={{ backgroundColor: '#ffffff', minHeight: '220px' }}
        >
          {/* Background */}
          <rect x="0" y="0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#ffffff" />
          
          {/* WEST label */}
          <text x="30" y="55" fontSize="14" fontWeight="bold" fill="#333333" textAnchor="middle">
            WEST
          </text>
          
          {/* EAST label */}
          <text x={CANVAS_WIDTH - 30} y="55" fontSize="14" fontWeight="bold" fill="#333333" textAnchor="middle">
            EAST
          </text>
          
          {/* Room tiles */}
          {FLOOR_LAYOUT.map(room => {
            const mappedRoomId = remapRoomId(room.id, unitNumber);
            const status = getRoomStatus(mappedRoomId);
            const fillColor = getStatusColor(status);
            const textColor = getTextColor(status);
            
            return (
              <g key={room.id}>
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.w}
                  height={room.h}
                  fill={fillColor}
                  stroke="#333333"
                  strokeWidth="1"
                />
                <text
                  x={room.x + room.w / 2}
                  y={room.y + room.h / 2 + 5}
                  fontSize="11"
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
