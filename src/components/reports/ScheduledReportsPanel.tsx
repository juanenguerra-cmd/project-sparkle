import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Bell, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ScheduledReport {
  id: string;
  reportId: string;
  reportName: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  enabled: boolean;
  lastReminder?: string;
}

const STORAGE_KEY = 'icn_scheduled_reports';

const reportOptions = [
  { id: 'precautions_list', name: 'Daily Precautions List' },
  { id: 'daily_ip', name: 'Daily IP Worklist' },
  { id: 'abt_review', name: 'ABT Review Worklist' },
  { id: 'vax_due', name: 'Vaccination Due List' },
  { id: 'qapi', name: 'QAPI Report' },
  { id: 'survey_readiness', name: 'Survey Readiness Packet' },
  { id: 'infection_trends', name: 'Infection Rate Trends' },
  { id: 'compliance', name: 'Compliance Crosswalk' },
];

const ScheduledReportsPanel = () => {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReportId, setNewReportId] = useState('');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [newTime, setNewTime] = useState('08:00');

  // Load schedules from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSchedules(JSON.parse(saved));
      } catch {
        setSchedules([]);
      }
    }
  }, []);

  // Save schedules to localStorage
  const saveSchedules = (updated: ScheduledReport[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSchedules(updated);
  };

  // Check for due reminders
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      const today = now.toISOString().slice(0, 10);
      const dayOfWeek = now.getDay();
      const dayOfMonth = now.getDate();

      schedules.forEach(schedule => {
        if (!schedule.enabled) return;
        if (schedule.lastReminder === today) return;

        const shouldRemind = (() => {
          if (schedule.time !== currentTime) return false;
          
          switch (schedule.frequency) {
            case 'daily':
              return true;
            case 'weekly':
              return dayOfWeek === 1; // Monday
            case 'monthly':
              return dayOfMonth === 1;
            default:
              return false;
          }
        })();

        if (shouldRemind) {
          toast.info(`📋 Reminder: Generate "${schedule.reportName}"`, {
            duration: 10000,
            action: {
              label: 'Dismiss',
              onClick: () => {},
            },
          });
          
          // Update last reminder
          const updated = schedules.map(s => 
            s.id === schedule.id ? { ...s, lastReminder: today } : s
          );
          saveSchedules(updated);
        }
      });
    };

    const interval = setInterval(checkReminders, 60000); // Check every minute
    checkReminders(); // Check immediately on mount

    return () => clearInterval(interval);
  }, [schedules]);

  const handleAddSchedule = () => {
    if (!newReportId) {
      toast.error('Please select a report');
      return;
    }

    const report = reportOptions.find(r => r.id === newReportId);
    if (!report) return;

    const newSchedule: ScheduledReport = {
      id: Date.now().toString(),
      reportId: newReportId,
      reportName: report.name,
      frequency: newFrequency,
      time: newTime,
      enabled: true,
    };

    saveSchedules([...schedules, newSchedule]);
    setShowAddForm(false);
    setNewReportId('');
    setNewFrequency('daily');
    setNewTime('08:00');
    toast.success(`Scheduled: ${report.name}`);
  };

  const handleToggle = (id: string) => {
    const updated = schedules.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    saveSchedules(updated);
  };

  const handleDelete = (id: string) => {
    const updated = schedules.filter(s => s.id !== id);
    saveSchedules(updated);
    toast.success('Schedule removed');
  };

  const frequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Every day';
      case 'weekly': return 'Every Monday';
      case 'monthly': return 'First of month';
      default: return freq;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Report Reminders</span>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      {showAddForm && (
        <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Report</Label>
              <Select value={newReportId} onValueChange={setNewReportId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select report..." />
                </SelectTrigger>
                <SelectContent>
                  {reportOptions.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={newFrequency} onValueChange={(v) => setNewFrequency(v as 'daily' | 'weekly' | 'monthly')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                  <SelectItem value="monthly">Monthly (1st)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input 
                type="time" 
                value={newTime} 
                onChange={e => setNewTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAddSchedule}>
              Save Schedule
            </Button>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No scheduled reminders. Add one to get notified when reports are due.
        </p>
      ) : (
        <div className="space-y-2">
          {schedules.map(schedule => (
            <div 
              key={schedule.id} 
              className={`flex items-center justify-between p-3 rounded-lg border ${
                schedule.enabled ? 'border-border bg-background' : 'border-muted bg-muted/30 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Switch 
                  checked={schedule.enabled} 
                  onCheckedChange={() => handleToggle(schedule.id)}
                />
                <div>
                  <p className="text-sm font-medium">{schedule.reportName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{frequencyLabel(schedule.frequency)}</span>
                    <Clock className="w-3 h-3 ml-2" />
                    <span>{schedule.time}</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleDelete(schedule.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Reminders appear as notifications when the app is open. For email delivery, a backend service is required.
      </p>
    </div>
  );
};

export default ScheduledReportsPanel;
