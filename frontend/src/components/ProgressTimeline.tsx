import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  ovr: number;
}

interface ProgressTimelineProps {
  data?: DataPoint[];
}

const emptyState = (
  <div className="flex items-center justify-center h-full">
    <p className="text-sm text-muted-foreground text-center">
      No sessions yet. Upload your first session to start tracking progress.
    </p>
  </div>
);

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-md px-3 py-2 text-sm shadow-md">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-semibold text-foreground">OVR {payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export function ProgressTimeline({ data = [] }: ProgressTimelineProps) {
  const hasData = data.length > 0;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Progress Timeline</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Overall rating over time</p>
      </div>

      <div className="flex-1 px-2 py-4 min-h-[220px]">
        {!hasData ? emptyState : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="ovr"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: "#22c55e", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#22c55e" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
