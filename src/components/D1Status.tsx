import { useEffect, useState } from "react";

type D1Health = {
  ok: boolean;
  indicator?: string;
  status?: "ACTIVE" | "INACTIVE";
  sync?: "COMPLETE" | "FAILED" | "NOT_SYNCED";
  rows?: number;
  checkedAt?: string;
  error?: string;
};

export default function D1Status() {
  const [data, setData] = useState<D1Health | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/health/d1", { cache: "no-store" });
      const json = (await res.json()) as D1Health;
      setData(json);
    } catch {
      setData({
        ok: false,
        indicator: "🔴 INACTIVE · NOT SYNCED",
        status: "INACTIVE",
        sync: "NOT_SYNCED",
        error: "Failed to fetch /api/health/d1",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const indicator = loading ? "⏳ Checking D1…" : data?.indicator ?? "—";
  const rows = data?.rows;

  const bg = indicator.includes("🟢")
    ? "#e7f7ee"
    : indicator.includes("🟡")
    ? "#fff5db"
    : "#fde8e8";

  const border = indicator.includes("🟢")
    ? "#34c759"
    : indicator.includes("🟡")
    ? "#f5a623"
    : "#ff3b30";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: `1px solid ${border}`,
          background: bg,
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
        title={data?.checkedAt ? `Last check: ${data.checkedAt}` : undefined}
      >
        {indicator}
      </span>

      {!loading && typeof rows === "number" && (
        <span style={{ fontSize: 12, opacity: 0.8 }}>rows: {rows}</span>
      )}

      <button
        onClick={load}
        type="button"
        style={{
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "white",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        Refresh
      </button>
    </div>
  );
}
