interface DataPoint {
  date: string;
  ovr: number;
}

interface ProgressTimelineProps {
  data?: DataPoint[];
  delta?: string;
}

function Sparkline({ data }: { data: DataPoint[] }) {
  const pad = 6;
  const w = 320;
  const h = 120;
  const min = Math.min(...data.map((d) => d.ovr)) - 4;
  const max = Math.max(...data.map((d) => d.ovr)) + 4;
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(data.length - 1, 1);
  const y = (v: number) => pad + (h - pad * 2) * (1 - (v - min) / Math.max(max - min, 1));
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.ovr)}`).join(" ");
  const area = `${path} L ${x(data.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(153 60% 45%)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(153 60% 45%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkGrad)" />
      <path d={path} fill="none" stroke="hsl(153 60% 50%)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(d.ovr)}
          r={i === data.length - 1 ? 4 : 2.5}
          fill={i === data.length - 1 ? "hsl(153 60% 55%)" : "hsl(222 18% 15%)"}
          stroke="hsl(153 60% 50%)"
          strokeWidth={i === data.length - 1 ? 2 : 1.5}
        />
      ))}
    </svg>
  );
}

export function ProgressTimeline({ data = [], delta }: ProgressTimelineProps) {
  const hasData = data.length >= 2;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">OVR over time</h3>
        {delta && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-secondary rounded-md px-2 py-1">
            <span className="text-primary">▲ {delta}</span>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex-1 flex items-center justify-center min-h-[120px]">
          <p className="text-sm text-muted-foreground text-center">
            No sessions yet. Upload your first session to start tracking progress.
          </p>
        </div>
      ) : (
        <>
          <Sparkline data={data} />
          <div
            className="grid mt-2 text-[10px] font-mono text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}
          >
            {data.map((d, i) => (
              <div key={i} className="text-center">
                <div>{d.date}</div>
                <div className="text-foreground/70 font-bold mt-0.5">{d.ovr}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
