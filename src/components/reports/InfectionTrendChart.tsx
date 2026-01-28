import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendDataPoint } from '@/lib/reportGenerators';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface InfectionTrendChartProps {
  data: TrendDataPoint[];
}

const COLORS = [
  'hsl(var(--destructive))',
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(var(--accent))',
];

const InfectionTrendChart = ({ data }: InfectionTrendChartProps) => {
  // Calculate totals for pie chart
  const totalIP = data.reduce((sum, d) => sum + d.ipCases, 0);
  const totalABT = data.reduce((sum, d) => sum + d.abtCourses, 0);
  
  const pieData = [
    { name: 'IP Cases', value: totalIP },
    { name: 'ABT Courses', value: totalABT },
  ];

  // Calculate averages for benchmark comparison
  const avgIPRate = data.length > 0 ? data.reduce((sum, d) => sum + d.ipRate, 0) / data.length : 0;
  const avgABTRate = data.length > 0 ? data.reduce((sum, d) => sum + d.abtRate, 0) / data.length : 0;
  
  // National benchmarks (example values)
  const nationalIPBenchmark = 3.5;
  const nationalABTBenchmark = 8.0;

  return (
    <div className="space-y-4 p-4">
      <Tabs defaultValue="trend" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trend">Trend Line</TabsTrigger>
          <TabsTrigger value="rates">Rate Comparison</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="area">Cumulative</TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="mt-4">
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">Infection Cases & ABT Courses (6-Month Trend)</h4>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="ipCases" 
                  name="IP Cases" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--destructive))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="abtCourses" 
                  name="ABT Courses" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="rates" className="mt-4">
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">Infection Rates per 100 Residents vs National Benchmarks</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Avg IP Rate</div>
                <div className={`text-xl font-bold ${avgIPRate > nationalIPBenchmark ? 'text-destructive' : 'text-success'}`}>
                  {avgIPRate.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">Benchmark: {nationalIPBenchmark}%</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-center">
                <div className="text-xs text-muted-foreground mb-1">Avg ABT Rate</div>
                <div className={`text-xl font-bold ${avgABTRate > nationalABTBenchmark ? 'text-destructive' : 'text-success'}`}>
                  {avgABTRate.toFixed(2)}%
                </div>
                <div className="text-xs text-muted-foreground">Benchmark: {nationalABTBenchmark}%</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" unit="%" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                />
                <Legend />
                <Bar dataKey="ipRate" name="IP Rate" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="abtRate" name="ABT Rate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="mt-4">
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">Case Distribution (6-Month Total)</h4>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="text-center">
                <div className="text-2xl font-bold text-destructive">{totalIP}</div>
                <div className="text-sm text-muted-foreground">Total IP Cases</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalABT}</div>
                <div className="text-sm text-muted-foreground">Total ABT Courses</div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="area" className="mt-4">
          <div>
            <h4 className="font-semibold text-sm mb-3 text-foreground">Cumulative Case Trends</h4>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="ipCases" 
                  name="IP Cases" 
                  stroke="hsl(var(--destructive))" 
                  fill="hsl(var(--destructive))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="abtCourses" 
                  name="ABT Courses" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InfectionTrendChart;
