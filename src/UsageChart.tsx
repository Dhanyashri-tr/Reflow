import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { client } from "./amplifyClient";

type UsageRecord = {
  id: string;
  date: string;
  deliveredLitres: number;
  freshwaterReplacedLitres: number;
  confirmed: boolean;
};

export default function UsageChart() {
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [days, setDays] = useState<7 | 30>(7);

  const loadRecords = useCallback(async () => {
    try {
      const result = await client.models.ActualUsage.list({ limit: 100 });

      if (result.errors?.length) {
        throw new Error(result.errors.map((item) => item.message).join("; "));
      }

      const usageRecords = (result.data ?? []) as UsageRecord[];

      setRecords(
        usageRecords
          .filter((item) => item.confirmed)
          .sort((a, b) => a.date.localeCompare(b.date)),
      );
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load usage data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();

    const timer = window.setInterval(() => {
      void loadRecords();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [loadRecords]);

  const filteredRecords = useMemo(() => {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  const cutoffDate = cutoff.toISOString().slice(0, 10);

  return records.filter((record) => record.date >= cutoffDate);
}, [records, days]);

const totals = useMemo(() => {
  const delivered = filteredRecords.reduce(
    (sum, record) => sum + (Number(record.deliveredLitres) || 0),
    0,
  );

  const replaced = filteredRecords.reduce(
    (sum, record) =>
      sum + (Number(record.freshwaterReplacedLitres) || 0),
    0,
  );

  return {
    delivered,
    replaced,
    replacementRate:
      delivered > 0 ? (replaced / delivered) * 100 : null,
  };
}, [filteredRecords]);

const chartData = Object.values(
  filteredRecords.reduce<
    Record<
      string,
      {
        date: string;
        deliveredLitres: number;
        freshwaterReplacedLitres: number;
      }
    >
  >((groups, record) => {
    const day = record.date;

    if (!groups[day]) {
      groups[day] = {
        date: day,
        deliveredLitres: 0,
        freshwaterReplacedLitres: 0,
      };
    }

    groups[day].deliveredLitres += Number(record.deliveredLitres) || 0;
    groups[day].freshwaterReplacedLitres +=
      Number(record.freshwaterReplacedLitres) || 0;

    return groups;
  }, {}),
).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <section className="section" id="usage-chart">
       <div className="heading">
  <div>
    <p className="eyebrow">LIVE DATA / AWS</p>
    <h2>Water usage over time</h2>
    <p>Confirmed actual-usage records from ReFlow.</p>
  </div>
  <button
    className="button"
    onClick={() => void loadRecords()}
    disabled={loading}
  >
    {loading ? "Refreshing..." : "Refresh data"}
  </button>
</div>

<div className="range-controls" role="group" aria-label="Chart date range">
  <button
    className={`range-button ${days === 7 ? "selected" : ""}`}
    aria-pressed={days === 7}
    onClick={() => setDays(7)}
  >
    7 days
  </button>
  <button
    className={`range-button ${days === 30 ? "selected" : ""}`}
    aria-pressed={days === 30}
    onClick={() => setDays(30)}
  >
    30 days
  </button>
</div>

<div className="usage-summary">
  <article className="panel">
    <p className="eyebrow">TREATED WATER DELIVERED</p>
    <h3>{totals.delivered.toLocaleString("en-IN")} L</h3>
    <p className="help">Confirmed records · Last {days} days</p>
  </article>
  <article className="panel">
    <p className="eyebrow">FRESHWATER REPLACED</p>
    <h3>{totals.replaced.toLocaleString("en-IN")} L</h3>
    <p className="help">Confirmed records · Last {days} days</p>
  </article>
  <article className="panel">
  <p className="eyebrow">FRESHWATER REPLACEMENT RATE</p>
  <h3>
    {totals.replacementRate === null
      ? "—"
      : `${totals.replacementRate.toFixed(1)}%`}
  </h3>
  <p className="help">
    Freshwater replaced ÷ treated water delivered
  </p>
</article>
</div>

      <article className="panel">
        <p className="help" role="status">
          {lastUpdated
            ? `Last updated: ${lastUpdated.toLocaleTimeString()} · Refreshes every 30 seconds`
            : "Loading records from AWS..."}
        </p>

        {error ? (
          <p className="message" role="alert">
            Could not load AWS usage data: {error}
          </p>
        ) : loading && records.length === 0 ? (
          <p>Loading water usage records...</p>
        ) : chartData.length === 0 ? (
          <p>
            No confirmed usage records yet. Save actual usage in the planner,
            then refresh this graph.
          </p>
        ) : (
          <div style={{ width: "100%", height: 340 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 20, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis
                  tickFormatter={(value: number) =>
                    `${value.toLocaleString("en-IN")} L`
                  }
                />
                <Tooltip
                  formatter={(value) =>
                    `${Number(value).toLocaleString("en-IN")} L`
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="deliveredLitres"
                  name="Treated water delivered"
                  stroke="#16856b"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="freshwaterReplacedLitres"
                  name="Freshwater replaced"
                  stroke="#3978d4"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="help">
          Values are aggregated by date from confirmed records. They are
          user-entered measurements, not independently verified sensor readings.
        </p>
      </article>
    </section>
  );
}