import { useMemo, useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Calendar, Activity, Pill, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { loadDB, getActiveIPCases, getActiveABT } from '@/lib/database';
import {
  createForecast,
  calculateOutbreakRisk,
  getSeasonalRisk,
  type ForecastResult,
  type OutbreakRisk,
  type DataPoint,
} from '@/lib/analytics/forecasting';

type MetricType = 'infections' | 'abt' | 'outbreak';
type HorizonType = '7' | '30' | '90';

const TrendPredictionPanel = () => {
  const [activeMetric, setActiveMetric] = useState<MetricType>('infections');
  const [horizon, setHorizon] = useState<HorizonType>('30');
  const db = useMemo(() => loadDB(), []);
  const today = new Date().toISOString().slice(0, 10);

  // Build historical data from records
  const { infectionHistory, abtHistory, outbreakRisk } = useMemo(() => {
    // Group IP cases by onset date (last 90 days)
    const ipCases = db.records.ip_cases;
    const ipByDate: Record<string, number> = {};
    const last90 = new Date();
    last90.setDate(last90.getDate() - 90);

    ipCases.forEach(c => {
      const onset = c.onset_date || c.onsetDate || c.createdAt?.slice(0, 10);
      if (onset && onset >= last90.toISOString().slice(0, 10)) {
        ipByDate[onset] = (ipByDate[onset] || 0) + 1;
      }
    });

    // Fill gaps for continuous time series
    const infectionHistory: DataPoint[] = [];
    for (let d = new Date(last90); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      infectionHistory.push({ date: dateStr, value: ipByDate[dateStr] || 0 });
    }

    // Group ABT by start date
    const abxRecords = db.records.abx;
    const abtByDate: Record<string, number> = {};
    abxRecords.forEach(r => {
      const start = r.startDate || r.start_date;
      if (start && start >= last90.toISOString().slice(0, 10)) {
        abtByDate[start] = (abtByDate[start] || 0) + 1;
      }
    });

    const abtHistory: DataPoint[] = [];
    for (let d = new Date(last90); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      abtHistory.push({ date: dateStr, value: abtByDate[dateStr] || 0 });
    }

    // Outbreak risk calculation
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);
    const recentIP = ipCases.filter(c => {
      const onset = c.onset_date || c.onsetDate || c.createdAt?.slice(0, 10);
      return onset && onset >= last30.toISOString().slice(0, 10);
    });

    const byType: Record<string, number> = {};
    const byUnit: Record<string, number> = {};
    recentIP.forEach(c => {
      const type = c.infection_type || c.infectionType || 'Other';
      const unit = c.unit || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;
      byUnit[unit] = (byUnit[unit] || 0) + 1;
    });

    const seasonal = getSeasonalRisk(today);
    const outbreakRisk = calculateOutbreakRisk(byType, byUnit, seasonal.multiplier);

    return { infectionHistory, abtHistory, outbreakRisk };
  }, [db, today]);

  // Generate forecasts
  const infectionForecast = useMemo(() => 
    createForecast(infectionHistory, { warn: 3, critical: 5 }, 'Daily Infections'),
    [infectionHistory]
  );

  const abtForecast = useMemo(() => 
    createForecast(abtHistory, { warn: 5, critical: 10 }, 'Daily ABT Starts'),
    [abtHistory]
  );

  const activeForecast = activeMetric === 'infections' ? infectionForecast : abtForecast;
  const forecastData = horizon === '7' 
    ? activeForecast.forecast7 
    : horizon === '30' 
      ? activeForecast.forecast30 
      : activeForecast.forecast90;

  // Combine historical + forecast for chart
  const chartData = useMemo(() => {
    const historical = activeForecast.historical.slice(-30).map(d => ({
      ...d,
      lower: undefined,
      upper: undefined,
      isForecast: false,
    }));
    return [...historical, ...forecastData];
  }, [activeForecast, forecastData]);

  const seasonal = getSeasonalRisk(today);

  const TrendIcon = activeForecast.trend === 'increasing' 
    ? TrendingUp 
    : activeForecast.trend === 'decreasing' 
      ? TrendingDown 
      : Minus;

  const trendColor = activeForecast.trend === 'increasing' 
    ? 'text-destructive' 
    : activeForecast.trend === 'decreasing' 
      ? 'text-success' 
      : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {activeForecast.alert && (
        <Alert variant={activeForecast.alert.level === 'critical' ? 'destructive' : 'default'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {activeForecast.alert.level === 'critical' ? 'Critical Alert' : 'Warning'}
          </AlertTitle>
          <AlertDescription>{activeForecast.alert.message}</AlertDescription>
        </Alert>
      )}

      {seasonal.inSeason && (
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertTitle>Seasonal Risk Period</AlertTitle>
          <AlertDescription>
            Currently in {seasonal.windows.join(', ')}. Risk multiplier: ×{seasonal.multiplier.toFixed(1)}
          </AlertDescription>
        </Alert>
      )}

      {/* Metric Tabs */}
      <Tabs value={activeMetric} onValueChange={(v) => setActiveMetric(v as MetricType)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="infections" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Infections
          </TabsTrigger>
          <TabsTrigger value="abt" className="flex items-center gap-2">
            <Pill className="w-4 h-4" />
            ABT Starts
          </TabsTrigger>
          <TabsTrigger value="outbreak" className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Outbreak Risk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="infections" className="space-y-4">
          <ForecastChart 
            data={chartData} 
            forecast={activeForecast}
            horizon={horizon}
            setHorizon={setHorizon}
            TrendIcon={TrendIcon}
            trendColor={trendColor}
          />
        </TabsContent>

        <TabsContent value="abt" className="space-y-4">
          <ForecastChart 
            data={chartData} 
            forecast={activeForecast}
            horizon={horizon}
            setHorizon={setHorizon}
            TrendIcon={TrendIcon}
            trendColor={trendColor}
          />
        </TabsContent>

        <TabsContent value="outbreak" className="space-y-4">
          <OutbreakRiskCard risk={outbreakRisk} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface ForecastChartProps {
  data: any[];
  forecast: ForecastResult;
  horizon: HorizonType;
  setHorizon: (h: HorizonType) => void;
  TrendIcon: typeof TrendingUp;
  trendColor: string;
}

const ForecastChart = ({ data, forecast, horizon, setHorizon, TrendIcon, trendColor }: ForecastChartProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <div className="flex items-center gap-3">
        <CardTitle className="text-lg">Trend Forecast</CardTitle>
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-sm font-medium">
            {forecast.trendPercent > 0 ? '+' : ''}{forecast.trendPercent}%
          </span>
        </div>
      </div>
      <div className="flex gap-1">
        {(['7', '30', '90'] as HorizonType[]).map(h => (
          <Badge 
            key={h}
            variant={horizon === h ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setHorizon(h)}
          >
            {h}d
          </Badge>
        ))}
      </div>
    </CardHeader>
    <CardContent>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip 
              labelFormatter={(d) => new Date(d).toLocaleDateString()}
              formatter={(value: number, name: string) => [
                value.toFixed(1), 
                name === 'value' ? 'Actual/Forecast' : name
              ]}
            />
            <Area 
              dataKey="upper" 
              stroke="none" 
              fill="hsl(var(--primary))" 
              fillOpacity={0.1}
              stackId="confidence"
            />
            <Area 
              dataKey="lower" 
              stroke="none" 
              fill="white" 
              stackId="confidence"
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Solid line: historical data. Dashed line with shaded band: forecast with 95% confidence interval.
      </p>
    </CardContent>
  </Card>
);

interface OutbreakRiskCardProps {
  risk: OutbreakRisk;
}

const OutbreakRiskCard = ({ risk }: OutbreakRiskCardProps) => {
  const riskColors: Record<OutbreakRisk['level'], string> = {
    low: 'bg-success/20 text-success border-success/30',
    moderate: 'bg-warning/20 text-warning border-warning/30',
    high: 'bg-destructive/20 text-destructive border-destructive/30',
    critical: 'bg-destructive text-destructive-foreground border-destructive',
  };

  return (
    <Card className={`border-2 ${riskColors[risk.level]}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Outbreak Risk Score</span>
          <Badge variant={risk.level === 'critical' ? 'destructive' : 'outline'} className="text-lg px-3 py-1">
            {risk.score}/100
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                risk.level === 'low' ? 'bg-success' :
                risk.level === 'moderate' ? 'bg-warning' :
                'bg-destructive'
              }`}
              style={{ width: `${risk.score}%` }}
            />
          </div>
          <span className="font-semibold capitalize">{risk.level}</span>
        </div>

        {risk.factors.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Contributing Factors:</h4>
            <ul className="space-y-1">
              {risk.factors.map((f, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {risk.factors.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No significant risk factors detected. Continue routine surveillance.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default TrendPredictionPanel;
