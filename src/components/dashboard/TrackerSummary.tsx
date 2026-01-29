import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { loadDB, getActiveABT, getActiveIPCases, getVaxDue } from '@/lib/database';
import { isoDateFromAny } from '@/lib/parsers';
import { subDays, isAfter, parseISO } from 'date-fns';

interface TrackerSummaryProps {
  type: 'abt' | 'ip' | 'vax';
}

const TrackerSummary = ({ type }: TrackerSummaryProps) => {
  const db = loadDB();
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  const sevenDaysAgo = subDays(today, 7);

  const summary = useMemo(() => {
    if (type === 'abt') {
      const allRecords = db.records.abx;
      const activeRecords = getActiveABT(db);
      
      // Count new starts in last 7 days
      const newThisWeek = allRecords.filter(r => {
        const startDate = isoDateFromAny(r.startDate || r.start_date || '');
        return startDate && isAfter(parseISO(startDate), sevenDaysAgo);
      }).length;
      
      // Count new starts in last 30 days
      const newThisMonth = allRecords.filter(r => {
        const startDate = isoDateFromAny(r.startDate || r.start_date || '');
        return startDate && isAfter(parseISO(startDate), thirtyDaysAgo);
      }).length;
      
      // Calculate average days of therapy
      const avgDOT = activeRecords.length > 0
        ? Math.round(activeRecords.reduce((sum, r) => sum + (r.tx_days || r.daysOfTherapy || 0), 0) / activeRecords.length)
        : 0;
      
      // Count by infection source
      const sourceCounts: Record<string, number> = {};
      activeRecords.forEach(r => {
        const source = r.infection_source || 'Other';
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      });
      const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
      
      // Trend analysis
      const prevMonthRecords = allRecords.filter(r => {
        const startDate = isoDateFromAny(r.startDate || r.start_date || '');
        if (!startDate) return false;
        const date = parseISO(startDate);
        return isAfter(date, subDays(thirtyDaysAgo, 30)) && !isAfter(date, thirtyDaysAgo);
      }).length;
      
      const trend = newThisMonth > prevMonthRecords ? 'up' : newThisMonth < prevMonthRecords ? 'down' : 'stable';
      const trendPercent = prevMonthRecords > 0 
        ? Math.round(Math.abs(newThisMonth - prevMonthRecords) / prevMonthRecords * 100)
        : 0;

      return {
        title: 'ABT Utilization Summary',
        metrics: [
          { label: 'New starts this week', value: newThisWeek, icon: Activity },
          { label: 'New starts this month', value: newThisMonth, icon: Activity },
          { label: 'Average days of therapy', value: `${avgDOT} days`, icon: CheckCircle },
          { label: 'Top infection source', value: topSource ? `${topSource[0]} (${topSource[1]})` : 'N/A', icon: AlertTriangle },
        ],
        trend,
        trendMessage: trend === 'up' 
          ? `↑ ${trendPercent}% increase in ABT utilization vs. prior month`
          : trend === 'down'
          ? `↓ ${trendPercent}% decrease in ABT utilization vs. prior month`
          : 'ABT utilization stable compared to prior month',
        insight: activeRecords.length > 5 
          ? 'Consider reviewing high-utilization units for stewardship opportunities.'
          : activeRecords.length === 0
          ? 'No active antibiotic courses. Great stewardship!'
          : 'ABT utilization within expected range.',
      };
    }

    if (type === 'ip') {
      const allRecords = db.records.ip_cases;
      const activeRecords = getActiveIPCases(db);
      
      // Count new cases this week
      const newThisWeek = allRecords.filter(r => {
        const onsetDate = r.onsetDate || r.onset_date;
        return onsetDate && isAfter(parseISO(onsetDate), sevenDaysAgo);
      }).length;
      
      // Count new cases this month
      const newThisMonth = allRecords.filter(r => {
        const onsetDate = r.onsetDate || r.onset_date;
        return onsetDate && isAfter(parseISO(onsetDate), thirtyDaysAgo);
      }).length;
      
      // Count by protocol
      const ebpCount = activeRecords.filter(r => r.protocol === 'EBP').length;
      const isoCount = activeRecords.filter(r => r.protocol === 'Isolation').length;
      
      // Overdue reviews
      const overdueCount = activeRecords.filter(r => {
        const reviewDate = r.nextReviewDate || r.next_review_date;
        return reviewDate && new Date(reviewDate) < today;
      }).length;
      
      // Trend analysis
      const prevMonthRecords = allRecords.filter(r => {
        const onsetDate = r.onsetDate || r.onset_date;
        if (!onsetDate) return false;
        const date = parseISO(onsetDate);
        return isAfter(date, subDays(thirtyDaysAgo, 30)) && !isAfter(date, thirtyDaysAgo);
      }).length;
      
      const trend = newThisMonth > prevMonthRecords ? 'up' : newThisMonth < prevMonthRecords ? 'down' : 'stable';
      const trendPercent = prevMonthRecords > 0 
        ? Math.round(Math.abs(newThisMonth - prevMonthRecords) / prevMonthRecords * 100)
        : 0;

      return {
        title: 'Infection Prevention Summary',
        metrics: [
          { label: 'New cases this week', value: newThisWeek, icon: Activity },
          { label: 'EBP active', value: ebpCount, icon: CheckCircle },
          { label: 'Isolation active', value: isoCount, icon: AlertTriangle },
          { label: 'Overdue reviews', value: overdueCount, icon: AlertTriangle },
        ],
        trend,
        trendMessage: trend === 'up' 
          ? `↑ ${trendPercent}% increase in new IP cases vs. prior month`
          : trend === 'down'
          ? `↓ ${trendPercent}% decrease in new IP cases vs. prior month`
          : 'IP case rate stable compared to prior month',
        insight: overdueCount > 0
          ? `Action required: ${overdueCount} case(s) need immediate review.`
          : activeRecords.length === 0
          ? 'No active IP cases. Excellent infection control!'
          : 'All IP cases are current with review schedules.',
      };
    }

    if (type === 'vax') {
      const allRecords = db.records.vax;
      const dueRecords = getVaxDue(db);
      
      // Get active census MRNs
      const activeCensusMrns = new Set(
        Object.values(db.census.residentsByMrn)
          .filter(r => r.active_on_census)
          .map(r => r.mrn)
      );
      
      // Count given this month
      const givenThisMonth = allRecords.filter(r => {
        if (r.status !== 'given') return false;
        const dateGiven = r.dateGiven || r.date_given;
        return dateGiven && isAfter(parseISO(dateGiven), thirtyDaysAgo);
      }).length;
      
      // Count by vaccine type for due
      const vaccineCounts: Record<string, number> = {};
      dueRecords.forEach(r => {
        const vaccine = r.vaccine || r.vaccine_type || 'Other';
        vaccineCounts[vaccine] = (vaccineCounts[vaccine] || 0) + 1;
      });
      
      // Declined count
      const declinedCount = allRecords.filter(r => {
        if (r.status !== 'declined') return false;
        if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
        return true;
      }).length;
      
      // Overdue count
      const overdueCount = allRecords.filter(r => {
        if (r.status !== 'overdue') return false;
        if (r.mrn && !activeCensusMrns.has(r.mrn)) return false;
        return true;
      }).length;
      
      // Calculate compliance rate
      const totalActive = dueRecords.length + givenThisMonth;
      const complianceRate = totalActive > 0 ? Math.round((givenThisMonth / totalActive) * 100) : 100;

      return {
        title: 'Vaccination Summary',
        metrics: [
          { label: 'Given this month', value: givenThisMonth, icon: CheckCircle },
          { label: 'Currently due', value: dueRecords.length, icon: Activity },
          { label: 'Overdue', value: overdueCount, icon: AlertTriangle },
          { label: 'Declined (active)', value: declinedCount, icon: Minus },
        ],
        trend: complianceRate >= 80 ? 'up' : complianceRate >= 50 ? 'stable' : 'down',
        trendMessage: `${complianceRate}% vaccination compliance rate this month`,
        insight: overdueCount > 0
          ? `Priority: ${overdueCount} overdue vaccination(s) require follow-up.`
          : dueRecords.length === 0
          ? 'All residents are up-to-date on vaccinations!'
          : `${dueRecords.length} vaccination(s) due - continue outreach.`,
      };
    }

    return null;
  }, [db, type, thirtyDaysAgo, sevenDaysAgo, today]);

  if (!summary) return null;

  const TrendIcon = summary.trend === 'up' ? TrendingUp : summary.trend === 'down' ? TrendingDown : Minus;
  const trendColor = type === 'abt' 
    ? (summary.trend === 'down' ? 'text-success' : summary.trend === 'up' ? 'text-warning' : 'text-muted-foreground')
    : (summary.trend === 'up' ? 'text-warning' : summary.trend === 'down' ? 'text-success' : 'text-muted-foreground');

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">{summary.title}</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {summary.metrics.map((metric, idx) => (
          <div key={idx} className="bg-background/50 rounded-md p-3 text-center">
            <div className="text-xl font-bold text-foreground">{metric.value}</div>
            <div className="text-xs text-muted-foreground">{metric.label}</div>
          </div>
        ))}
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <TrendIcon className={`w-4 h-4 ${trendColor}`} />
        <span className={`text-sm font-medium ${trendColor}`}>{summary.trendMessage}</span>
      </div>
      
      <p className="text-sm text-muted-foreground italic">{summary.insight}</p>
    </div>
  );
};

export default TrackerSummary;
