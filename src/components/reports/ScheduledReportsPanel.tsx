import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Bell, Trash2, Plus, Users, Mail, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { addNotification } from '@/components/notifications/NotificationCenter';

interface ScheduledReport {
  id: string;
  reportId: string;
  reportName: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  enabled: boolean;
  recipients: string[]; // Email addresses for reference
  lastReminder?: string;
}

const STORAGE_KEY = 'icn_scheduled_reports';

const reportOptions = [
  { id: 'precautions_list', name: 'Daily Precautions List', category: 'Operational' },
  { id: 'daily_ip', name: 'Daily IP Worklist', category: 'Operational' },
  { id: 'abt_review', name: 'ABT Review Worklist', category: 'Operational' },
  { id: 'abt_duration', name: 'Antibiotic Duration Analysis', category: 'Operational' },
  { id: 'vax_due', name: 'Vaccination Due List', category: 'Operational' },
  { id: 'vax_reoffer', name: 'Vaccine Re-offer List', category: 'Operational' },
  { id: 'ip_review', name: 'IP Review Worklist', category: 'Operational' },
  { id: 'new_admit_screening', name: 'New Admission Screening', category: 'Operational' },
  { id: 'outbreak_summary', name: 'Outbreak Summary', category: 'Operational' },
  { id: 'qapi', name: 'QAPI Report', category: 'Executive' },
  { id: 'survey_readiness', name: 'Survey Readiness Packet', category: 'Executive' },
  { id: 'infection_trends', name: 'Infection Rate Trends', category: 'Executive' },
  { id: 'compliance', name: 'Compliance Crosswalk', category: 'Executive' },
  { id: 'medicare_compliance', name: 'Medicare ABT Compliance', category: 'Executive' },
  { id: 'hh_ppe_summary', name: 'Hand Hygiene & PPE Summary', category: 'Executive' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const ScheduledReportsPanel = () => {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newReportId, setNewReportId] = useState('');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [newTime, setNewTime] = useState('08:00');
  const [newDayOfWeek, setNewDayOfWeek] = useState(1); // Monday
  const [newDayOfMonth, setNewDayOfMonth] = useState(1);
  const [newRecipients, setNewRecipients] = useState('');

  // Load schedules from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate old schedules without recipients
        const migrated = parsed.map((s: ScheduledReport) => ({
          ...s,
          recipients: s.recipients || [],
          dayOfWeek: s.dayOfWeek ?? 1,
          dayOfMonth: s.dayOfMonth ?? 1,
        }));
        setSchedules(migrated);
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
              return dayOfWeek === (schedule.dayOfWeek ?? 1);
            case 'monthly':
              return dayOfMonth === (schedule.dayOfMonth ?? 1);
            default:
              return false;
          }
        })();

        if (shouldRemind) {
          const recipientInfo = schedule.recipients.length > 0 
            ? ` (Recipients: ${schedule.recipients.join(', ')})` 
            : '';
          
          // Add to notification center
          addNotification({
            type: 'report_reminder',
            title: `Report Due: ${schedule.reportName}`,
            message: `Scheduled ${schedule.frequency} report is ready to generate.${recipientInfo}`,
            reportId: schedule.reportId,
            recipients: schedule.recipients,
          });
          
          // Also show toast for immediate visibility
          toast.info(`📋 Reminder: Generate "${schedule.reportName}"${recipientInfo}`, {
            duration: 15000,
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

    // Parse recipients (comma or newline separated emails)
    const recipientList = newRecipients
      .split(/[,\n]/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0 && e.includes('@'));

    const newSchedule: ScheduledReport = {
      id: Date.now().toString(),
      reportId: newReportId,
      reportName: report.name,
      frequency: newFrequency,
      time: newTime,
      dayOfWeek: newDayOfWeek,
      dayOfMonth: newDayOfMonth,
      enabled: true,
      recipients: recipientList,
    };

    saveSchedules([...schedules, newSchedule]);
    setShowAddForm(false);
    setNewReportId('');
    setNewFrequency('daily');
    setNewTime('08:00');
    setNewDayOfWeek(1);
    setNewDayOfMonth(1);
    setNewRecipients('');
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

  const frequencyLabel = (schedule: ScheduledReport) => {
    switch (schedule.frequency) {
      case 'daily': 
        return 'Every day';
      case 'weekly': 
        const day = DAYS_OF_WEEK.find(d => d.value === schedule.dayOfWeek)?.label || 'Monday';
        return `Every ${day}`;
      case 'monthly': 
        const suffix = getOrdinalSuffix(schedule.dayOfMonth || 1);
        return `${schedule.dayOfMonth}${suffix} of month`;
      default: 
        return schedule.frequency;
    }
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  // Group reports by category
  const groupedReports = reportOptions.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {} as Record<string, typeof reportOptions>);

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
          {/* Email notice */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-muted border border-border">
            <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">In-app reminders only.</strong> Email delivery requires enabling Lovable Cloud backend. 
              Recipients are stored for reference.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Report</Label>
              <Select value={newReportId} onValueChange={setNewReportId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select report..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedReports).map(([category, reports]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{category}</div>
                      {reports.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </div>
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
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {newFrequency === 'weekly' && (
              <div>
                <Label className="text-xs">Day of Week</Label>
                <Select value={newDayOfWeek.toString()} onValueChange={(v) => setNewDayOfWeek(parseInt(v))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => (
                      <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newFrequency === 'monthly' && (
              <div>
                <Label className="text-xs">Day of Month</Label>
                <Select value={newDayOfMonth.toString()} onValueChange={(v) => setNewDayOfMonth(parseInt(v))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <SelectItem key={d} value={d.toString()}>{d}{getOrdinalSuffix(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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

          <div>
            <Label className="text-xs flex items-center gap-1">
              <Mail className="w-3 h-3" />
              Recipients (optional)
            </Label>
            <Textarea 
              value={newRecipients}
              onChange={e => setNewRecipients(e.target.value)}
              placeholder="Enter email addresses, one per line or comma-separated"
              className="mt-1 min-h-[60px] text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recipients will be shown in reminders. Email delivery coming soon with backend integration.
            </p>
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
              className={`p-3 rounded-lg border ${
                schedule.enabled ? 'border-border bg-background' : 'border-muted bg-muted/30 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch 
                    checked={schedule.enabled} 
                    onCheckedChange={() => handleToggle(schedule.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{schedule.reportName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{frequencyLabel(schedule)}</span>
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
              {schedule.recipients && schedule.recipients.length > 0 && (
                <div className="mt-2 pl-12 flex items-center gap-2 flex-wrap">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  {schedule.recipients.map((email, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {email}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        💡 Reminders appear as notifications when the app is open. Enable Lovable Cloud for automated email delivery.
      </p>
    </div>
  );
};

export default ScheduledReportsPanel;
