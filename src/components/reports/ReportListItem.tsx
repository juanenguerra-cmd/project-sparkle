import { useState } from 'react';
import { ChevronRight, FileText, Edit2, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getReportDescription, saveReportDescription, resetReportDescription } from '@/lib/reportDescriptions';
import { toast } from 'sonner';

interface ReportListItemProps {
  report: {
    id: string;
    name: string;
    description: string;
  };
  onGenerate: (reportId: string) => void;
  onDescriptionChange?: () => void;
}

const ReportListItem = ({ report, onGenerate, onDescriptionChange }: ReportListItemProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingDescription, setEditingDescription] = useState('');
  
  const description = getReportDescription(report.id);

  const handleStartEdit = () => {
    setEditingDescription(description);
    setIsEditing(true);
    setIsOpen(true);
  };

  const handleSave = () => {
    saveReportDescription(report.id, editingDescription);
    setIsEditing(false);
    onDescriptionChange?.();
    toast.success('Description updated');
  };

  const handleReset = () => {
    const defaultDesc = resetReportDescription(report.id);
    setEditingDescription(defaultDesc);
    onDescriptionChange?.();
    toast.success('Reset to default');
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md transition-colors group">
        {/* Expand trigger */}
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0">
            <ChevronRight className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        
        {/* Icon */}
        <FileText className="w-4 h-4 text-primary shrink-0" />
        
        {/* Report name */}
        <span className="font-medium text-sm flex-1 truncate">{report.name}</span>
        
        {/* Quick actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0"
            onClick={handleStartEdit}
            title="Edit description"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
        </div>
        
        {/* Generate button */}
        <Button 
          size="sm" 
          variant="outline"
          className="h-7 px-3 text-xs"
          onClick={() => onGenerate(report.id)}
        >
          <Zap className="w-3 h-3 mr-1" />
          Generate
        </Button>
      </div>
      
      {/* Collapsible description */}
      <CollapsibleContent>
        <div className="ml-10 mr-3 mb-2 p-3 bg-muted/30 rounded-md text-sm">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                className="text-sm min-h-[60px]"
                placeholder="Enter report description..."
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button size="sm" variant="ghost" onClick={handleReset} title="Reset to default">
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ReportListItem;
