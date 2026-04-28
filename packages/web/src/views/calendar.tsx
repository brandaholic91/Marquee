import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Sidebar } from "../components/layout/Sidebar";

interface CronJob {
  id: string;
  name: string;
  expression: string;
  description: string;
  enabled: boolean;
  lastRun?: string;
}

/** Parse a 5-field cron expression and return human-readable schedule + run times for a month */
function parseCron(expression: string): { label: string; hours: number[]; minutes: number[]; daysOfWeek: number[] | null; daysOfMonth: number[] | null } {
  const [min, hour, dom, , dow] = expression.split(" ");

  const parseField = (f: string, max: number): number[] => {
    if (f === "*") return Array.from({ length: max }, (_, i) => i);
    if (f.startsWith("*/")) { const step = parseInt(f.slice(2)); return Array.from({ length: max }, (_, i) => i).filter((i) => i % step === 0); }
    if (f.includes(",")) return f.split(",").map(Number);
    if (f.includes("-")) { const [a, b] = f.split("-").map(Number); return Array.from({ length: b - a + 1 }, (_, i) => i + a); }
    return [parseInt(f)];
  };

  const hours = parseField(hour, 24);
  const minutes = parseField(min, 60);
  const daysOfWeek = dow === "*" ? null : parseField(dow, 7);
  const daysOfMonth = dom === "*" ? null : parseField(dom, 32);

  // Build label
  const timeStr = hours.map((h) => `${String(h).padStart(2, "0")}:${String(minutes[0] ?? 0).padStart(2, "0")}`).join(", ");
  let when = "";
  if (daysOfWeek) {
    const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    when = `every ${daysOfWeek.map((d) => DAY[d]).join("/")} at ${timeStr}`;
  } else if (daysOfMonth) {
    when = `on day ${daysOfMonth.join(",")} at ${timeStr}`;
  } else {
    when = `daily at ${timeStr}`;
  }

  return { label: when, hours, minutes, daysOfWeek, daysOfMonth };
}

/** Returns true if the cron job runs on the given date */
function runsOnDate(job: CronJob, date: Date): boolean {
  const { daysOfWeek, daysOfMonth } = parseCron(job.expression);
  if (daysOfWeek !== null) return daysOfWeek.includes(date.getDay());
  if (daysOfMonth !== null) return daysOfMonth.includes(date.getDate());
  return true; // daily
}

function MonthCalendar({ jobs, year, month }: { jobs: CronJob[]; year: number; month: number }) {
  const today = new Date();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  // Offset: start week on Monday
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div style={{ textAlign: "center", fontWeight: 600, fontSize: 14, marginBottom: 12, color: "var(--ink-1)" }}>
        {MONTHS[month]} {year}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, color: "var(--ink-3)", padding: "4px 0", fontWeight: 600 }}>
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date = new Date(year, month, day);
          const dayJobs = jobs.filter((j) => j.enabled && runsOnDate(j, date));
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          return (
            <div
              key={i}
              style={{
                border: isToday ? "2px solid var(--bulb)" : "1px solid var(--rule)",
                borderRadius: 6,
                padding: "6px 4px",
                minHeight: 52,
                background: isToday ? "var(--primary-soft)" : "var(--parchment)",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? "var(--bulb)" : "var(--ink-2)", marginBottom: 3 }}>
                {day}
              </div>
              {dayJobs.map((j) => {
                const { hours, minutes } = parseCron(j.expression);
                const timeStr = `${String(hours[0]).padStart(2, "0")}:${String(minutes[0] ?? 0).padStart(2, "0")}`;
                return (
                  <div
                    key={j.id}
                    title={j.name}
                    style={{
                      fontSize: 10,
                      background: "var(--bulb)",
                      color: "#fff",
                      borderRadius: 3,
                      padding: "1px 4px",
                      marginBottom: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {timeStr} {j.name}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarView() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    fetch("/api/crons").then((r) => r.json()).then(setJobs).catch(console.error);
  }, []);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar activeNav="calendar" />
      <main style={{ flex: 1, padding: "28px 32px", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h1 className="heading">Calendar</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={prevMonth} style={{ background: "none", border: "1px solid var(--rule)", borderRadius: 4, cursor: "pointer", padding: "4px 10px", fontSize: 14 }}>‹</button>
            <button onClick={nextMonth} style={{ background: "none", border: "1px solid var(--rule)", borderRadius: 4, cursor: "pointer", padding: "4px 10px", fontSize: 14 }}>›</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 32 }}>
          {/* Calendar grid */}
          <MonthCalendar jobs={jobs} year={year} month={month} />

          {/* Cron job list */}
          <div>
            <div className="caption" style={{ marginBottom: 12, color: "var(--ink-3)" }}>Scheduled jobs</div>
            {jobs.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No cron jobs configured.</div>
            )}
            {jobs.map((j) => {
              const { label } = parseCron(j.expression);
              return (
                <div
                  key={j.id}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--rule)",
                    borderRadius: 6,
                    background: "var(--parchment)",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: j.enabled ? "var(--bulb)" : "var(--ink-3)",
                    }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)" }}>{j.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 4 }}>{j.description}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
                    {j.expression} — {label}
                  </div>
                  {j.lastRun && (
                    <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                      Last run: {new Date(j.lastRun).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
