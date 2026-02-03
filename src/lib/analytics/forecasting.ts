/**
 * Trend Prediction & Forecasting Module
 * 
 * Uses simple moving average + linear trend for explainable forecasts.
 * Outputs 7/30/90-day predictions with confidence bands.
 */

import { toLocalISODate } from '@/lib/parsers';

export interface DataPoint {
  date: string; // ISO date yyyy-mm-dd
  value: number;
}

export interface ForecastPoint extends DataPoint {
  lower: number;
  upper: number;
  isForecast: true;
}

export interface ForecastResult {
  historical: DataPoint[];
  forecast7: ForecastPoint[];
  forecast30: ForecastPoint[];
  forecast90: ForecastPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercent: number;
  alert?: ForecastAlert;
}

export interface ForecastAlert {
  level: 'info' | 'warn' | 'critical';
  message: string;
  thresholdExceeded?: number;
}

interface SeasonalWindow {
  name: string;
  startMmdd: string;
  endMmdd: string;
  riskMultiplier: number;
}

const SEASONAL_WINDOWS: SeasonalWindow[] = [
  { name: 'Flu Season', startMmdd: '10-01', endMmdd: '03-31', riskMultiplier: 1.5 },
  { name: 'RSV Peak', startMmdd: '11-01', endMmdd: '02-28', riskMultiplier: 1.3 },
  { name: 'GI Peak', startMmdd: '11-01', endMmdd: '04-30', riskMultiplier: 1.2 },
];

/**
 * Check if a date falls within a seasonal window
 */
export const getSeasonalRisk = (dateStr: string): { inSeason: boolean; windows: string[]; multiplier: number } => {
  const mmdd = dateStr.slice(5); // "mm-dd"
  const activeWindows: string[] = [];
  let maxMultiplier = 1.0;

  for (const w of SEASONAL_WINDOWS) {
    const inWindow = isDateInWindow(mmdd, w.startMmdd, w.endMmdd);
    if (inWindow) {
      activeWindows.push(w.name);
      maxMultiplier = Math.max(maxMultiplier, w.riskMultiplier);
    }
  }

  return { inSeason: activeWindows.length > 0, windows: activeWindows, multiplier: maxMultiplier };
};

const isDateInWindow = (mmdd: string, start: string, end: string): boolean => {
  // Handle wrap-around (e.g., Oct-Mar spans year boundary)
  if (start <= end) {
    return mmdd >= start && mmdd <= end;
  }
  return mmdd >= start || mmdd <= end;
};

/**
 * Simple Moving Average
 */
export const movingAverage = (data: number[], window: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
};

/**
 * Linear regression for trend
 */
export const linearTrend = (data: number[]): { slope: number; intercept: number } => {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope: isNaN(slope) ? 0 : slope, intercept: isNaN(intercept) ? 0 : intercept };
};

/**
 * Standard deviation
 */
export const stdDev = (data: number[]): number => {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (data.length - 1);
  return Math.sqrt(variance);
};

/**
 * Generate forecast points
 */
export const generateForecast = (
  historical: DataPoint[],
  daysAhead: number,
  confidenceMultiplier: number = 1.96 // 95% CI
): ForecastPoint[] => {
  if (historical.length < 3) return [];

  const values = historical.map(d => d.value);
  const smoothed = movingAverage(values, Math.min(7, values.length));
  const { slope, intercept } = linearTrend(smoothed);
  const residuals = smoothed.map((v, i) => values[i] - v);
  const sigma = stdDev(residuals);

  const lastDate = new Date(historical[historical.length - 1].date);
  const baseIndex = smoothed.length - 1;
  const forecast: ForecastPoint[] = [];

  for (let i = 1; i <= daysAhead; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + i);
    const dateStr = toLocalISODate(futureDate);

    // Trend projection + seasonal adjustment
    const trendValue = intercept + slope * (baseIndex + i);
    const seasonal = getSeasonalRisk(dateStr);
    const adjustedValue = Math.max(0, trendValue * seasonal.multiplier);

    // Widen confidence band over time
    const uncertainty = sigma * confidenceMultiplier * Math.sqrt(1 + i / smoothed.length);

    forecast.push({
      date: dateStr,
      value: Math.round(adjustedValue * 10) / 10,
      lower: Math.max(0, Math.round((adjustedValue - uncertainty) * 10) / 10),
      upper: Math.round((adjustedValue + uncertainty) * 10) / 10,
      isForecast: true,
    });
  }

  return forecast;
};

/**
 * Determine trend direction
 */
export const analyzeTrend = (values: number[]): { trend: ForecastResult['trend']; percent: number } => {
  if (values.length < 7) return { trend: 'stable', percent: 0 };

  const recent = values.slice(-7);
  const prior = values.slice(-14, -7);
  if (prior.length === 0) return { trend: 'stable', percent: 0 };

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;

  if (priorAvg === 0) return { trend: recentAvg > 0 ? 'increasing' : 'stable', percent: 0 };

  const pctChange = ((recentAvg - priorAvg) / priorAvg) * 100;

  if (pctChange > 10) return { trend: 'increasing', percent: Math.round(pctChange) };
  if (pctChange < -10) return { trend: 'decreasing', percent: Math.round(pctChange) };
  return { trend: 'stable', percent: Math.round(pctChange) };
};

/**
 * Generate alerts based on thresholds
 */
export const generateAlert = (
  forecast: ForecastPoint[],
  thresholds: { warn: number; critical: number },
  metricName: string
): ForecastAlert | undefined => {
  const maxForecast = Math.max(...forecast.map(f => f.value));

  if (maxForecast >= thresholds.critical) {
    return {
      level: 'critical',
      message: `${metricName} projected to reach ${maxForecast.toFixed(1)} (critical threshold: ${thresholds.critical})`,
      thresholdExceeded: thresholds.critical,
    };
  }

  if (maxForecast >= thresholds.warn) {
    return {
      level: 'warn',
      message: `${metricName} trending toward ${maxForecast.toFixed(1)} (warning threshold: ${thresholds.warn})`,
      thresholdExceeded: thresholds.warn,
    };
  }

  return undefined;
};

/**
 * Main forecast generator
 */
export const createForecast = (
  historical: DataPoint[],
  thresholds: { warn: number; critical: number },
  metricName: string
): ForecastResult => {
  const values = historical.map(d => d.value);
  const { trend, percent } = analyzeTrend(values);

  const forecast7 = generateForecast(historical, 7);
  const forecast30 = generateForecast(historical, 30);
  const forecast90 = generateForecast(historical, 90);

  // Use 30-day forecast for alerting
  const alert = generateAlert(forecast30, thresholds, metricName);

  return {
    historical,
    forecast7,
    forecast30,
    forecast90,
    trend,
    trendPercent: percent,
    alert,
  };
};

/**
 * Outbreak likelihood scoring
 * Based on cluster detection: ≥3 same type facility-wide OR ≥5 on single unit in 30 days
 */
export interface OutbreakRisk {
  score: number; // 0-100
  level: 'low' | 'moderate' | 'high' | 'critical';
  factors: string[];
}

export const calculateOutbreakRisk = (
  recentCasesByType: Record<string, number>,
  casesByUnit: Record<string, number>,
  seasonalMultiplier: number = 1.0
): OutbreakRisk => {
  const factors: string[] = [];
  let baseScore = 0;

  // Check for clusters by type
  for (const [type, count] of Object.entries(recentCasesByType)) {
    if (count >= 5) {
      baseScore += 40;
      factors.push(`${count} ${type} cases in 30 days (cluster threshold exceeded)`);
    } else if (count >= 3) {
      baseScore += 20;
      factors.push(`${count} ${type} cases approaching cluster threshold`);
    }
  }

  // Check for unit-level clusters
  for (const [unit, count] of Object.entries(casesByUnit)) {
    if (count >= 5) {
      baseScore += 30;
      factors.push(`${count} cases on ${unit} (unit cluster threshold exceeded)`);
    } else if (count >= 3) {
      baseScore += 15;
      factors.push(`${count} cases on ${unit} approaching threshold`);
    }
  }

  // Apply seasonal adjustment
  if (seasonalMultiplier > 1) {
    baseScore = Math.round(baseScore * seasonalMultiplier);
    factors.push(`Seasonal risk factor applied (×${seasonalMultiplier.toFixed(1)})`);
  }

  const score = Math.min(100, baseScore);
  let level: OutbreakRisk['level'] = 'low';
  if (score >= 70) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 25) level = 'moderate';

  return { score, level, factors };
};
