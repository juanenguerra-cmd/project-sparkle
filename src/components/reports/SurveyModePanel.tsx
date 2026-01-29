import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Shield, FileText, Pill, Users, Syringe, 
  CalendarIcon, ChevronDown, Download, Loader2, 
  ClipboardList, AlertCircle, CheckCircle2
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { loadDB } from '@/lib/database';
import { buildSurveyPack, type SurveyPackType } from '@/lib/pdf/surveyPackPdf';

interface SurveyModePanelProps {
  surveyorMode: boolean;
}

const SurveyModePanel = ({ surveyorMode }: SurveyModePanelProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [fromDate, setFromDate] = useState<Date>(subDays(new Date(), 14));
  const [toDate, setToDate] = useState<Date>(new Date());
  const [loadingPack, setLoadingPack] = useState<SurveyPackType | null>(null);

  const handleGeneratePack = async (packType: SurveyPackType) => {
    setLoadingPack(packType);
    
    try {
      const db = loadDB();
      const facility = db.settings.facilityName || 'Healthcare Facility';
      
      const result = await buildSurveyPack({
        packType,
        db,
        facility,
        fromDate: format(fromDate, 'yyyy-MM-dd'),
        toDate: format(toDate, 'yyyy-MM-dd'),
      });
      
      // Download the PDF
      const fileName = `Survey_${packType.replace('_', '_')}_Pack_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      result.doc.save(fileName);
      
      toast.success(`Survey pack generated with ${result.reportCount} reports`, {
        description: fileName,
      });
    } catch (error) {
      console.error('Error generating survey pack:', error);
      toast.error('Failed to generate survey pack');
    } finally {
      setLoadingPack(null);
    }
  };

  const packConfigs = [
    {
      id: 'audit' as SurveyPackType,
      name: 'Audit & Compliance',
      icon: ClipboardList,
      colorClass: 'bg-primary',
      description: 'HH + PPE/EBP audits + room checks + corrections',
      reports: [
        'Hand Hygiene Report (CDC 5 Moments)',
        'PPE Usage & Compliance',
        'Room Check Template',
        'Corrections Log Template',
      ],
    },
    {
      id: 'abt' as SurveyPackType,
      name: 'Active ABT',
      icon: Pill,
      colorClass: 'bg-success',
      description: 'Active antibiotics + time-outs due',
      reports: [
        'Active Antibiotics List',
        'ABT Time-out Review Due',
        'Missing Indications Report',
        'Missing Stop Dates Report',
      ],
    },
    {
      id: 'precautions' as SurveyPackType,
      name: 'Precautions Roster',
      icon: AlertCircle,
      colorClass: 'bg-warning',
      description: 'Active precautions by unit',
      reports: [
        'Active Precautions by Unit',
        'Daily Precaution List',
        'Daily IP Worklist',
        'EBP Eligibility Review',
      ],
    },
    {
      id: 'vaccination' as SurveyPackType,
      name: 'Vaccination Pack',
      icon: Syringe,
      colorClass: 'bg-secondary',
      description: 'Coverage + due list + declinations',
      reports: [
        'Vaccination Coverage Summary',
        'Due/Overdue List',
        'Declination Summary',
        'Re-offer List (30/180 day)',
      ],
    },
  ];

  if (!surveyorMode) {
    return null;
  }

  return (
    <Card className="border-warning/50 bg-warning/10 mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-warning/20 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-warning" />
                <div>
                  <CardTitle className="text-lg">
                    Survey Mode Quick Packs
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    One-click generation of compliance documentation
                  </p>
                </div>
                <Badge variant="outline" className="bg-warning text-warning-foreground border-0">
                  Active
                </Badge>
              </div>
              <ChevronDown className={cn(
                "h-5 w-5 text-warning transition-transform",
                isOpen && "rotate-180"
              )} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Date Range Selector */}
            <div className="flex flex-wrap items-center gap-4 p-3 bg-background rounded-lg border">
              <span className="text-sm font-medium text-muted-foreground">Date Range:</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(fromDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={(date) => date && setFromDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <span className="text-muted-foreground">to</span>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {format(toDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={(date) => date && setToDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate(subDays(new Date(), 14));
                  setToDate(new Date());
                }}
                className="text-warning hover:text-warning hover:bg-warning/20"
              >
                Reset to Last 14 Days
              </Button>
            </div>

            {/* Pack Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {packConfigs.map((pack) => {
                const Icon = pack.icon;
                const isLoading = loadingPack === pack.id;
                
                return (
                  <div
                    key={pack.id}
                    className="group relative bg-card rounded-lg border p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={cn("p-2 rounded-lg", pack.colorClass)}>
                        <Icon className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm">{pack.name}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {pack.description}
                        </p>
                      </div>
                    </div>
                    
                    {/* Reports list on hover */}
                    <div className="hidden group-hover:block absolute left-0 right-0 top-full z-10 mt-1 p-3 bg-popover border rounded-lg shadow-lg">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">Includes:</p>
                      <ul className="space-y-1">
                        {pack.reports.map((report, idx) => (
                          <li key={idx} className="text-xs flex items-center gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-success" />
                            {report}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => handleGeneratePack(pack.id)}
                      disabled={loadingPack !== null}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {isLoading ? 'Generating...' : 'Generate'}
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Complete Survey Pack Button */}
            <Button
              size="lg"
              className="w-full gap-3 bg-warning hover:bg-warning/90 text-warning-foreground h-14"
              onClick={() => handleGeneratePack('complete')}
              disabled={loadingPack !== null}
            >
              {loadingPack === 'complete' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              <div className="text-left">
                <div className="font-semibold">
                  {loadingPack === 'complete' ? 'Generating Complete Pack...' : 'Complete Survey Pack'}
                </div>
                <div className="text-xs opacity-90">All reports in one PDF with section dividers</div>
              </div>
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default SurveyModePanel;
