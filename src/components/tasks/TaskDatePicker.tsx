import { useState } from "react";
import { TextInput } from "@mantine/core";
import { addDays, addMonths, isDateString } from "../../domain/dates";

type Props = { today: string; value: string; label: string; error?: string; onChange: (date: string) => void };
const labelFor = (date: string, month = false) => new Intl.DateTimeFormat("pl-PL", {
  ...(month ? { month: "long" as const, year: "numeric" as const } : { day: "numeric" as const, month: "long" as const, year: "numeric" as const }), timeZone: "UTC",
}).format(new Date(`${date}T12:00:00Z`));

export function TaskDatePicker({ today, value, label, error, onChange }: Props) {
  const currentMonth = `${today.slice(0, 7)}-01`;
  const [month, setMonth] = useState(currentMonth);
  const offset = (new Date(`${month}T12:00:00Z`).getUTCDay() + 6) % 7;
  const days = new Date(`${addMonths(month, 1)}T12:00:00Z`);
  days.setUTCDate(0);
  const count = days.getUTCDate();
  function select(date: string) { onChange(date); setMonth(`${date.slice(0, 7)}-01`); }
  return (
    <aside className="task-date-panel" aria-label="Termin zadania">
      <div className="task-date-heading">{label === "Data startu" ? "Pierwszy termin" : "Termin zadania"}</div>
      <p className="task-selected-date" aria-live="polite">{isDateString(value) ? labelFor(value) : "Wybierz datę"}</p>
      <div className="task-calendar">
        <div className="task-calendar-header">
          <button type="button" aria-label="Poprzedni miesiąc" disabled={month <= currentMonth} onClick={() => setMonth(addMonths(month, -1))}>‹</button>
          <span aria-live="polite">{labelFor(month, true)}</span>
          <button type="button" aria-label="Następny miesiąc" onClick={() => setMonth(addMonths(month, 1))}>›</button>
        </div>
        <div className="task-date-shortcuts">
          {[{ name: "Dzisiaj", offset: 0 }, { name: "Jutro", offset: 1 }, { name: "Za tydzień", offset: 7 }].map(item => (
            <button type="button" key={item.name} onClick={() => select(addDays(today, item.offset))}>{item.name}</button>
          ))}
        </div>
        <div className="task-calendar-grid">
          {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map(day => <span key={day} className="task-calendar-weekday">{day}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: count }, (_, index) => {
            const date = addDays(month, index);
            return <button type="button" key={date} aria-label={labelFor(date)} aria-pressed={date === value}
              aria-current={date === today ? "date" : undefined} disabled={date < today} onClick={() => select(date)}>{index + 1}</button>;
          })}
        </div>
        <p className="task-calendar-caption">Dzisiaj i późniejsze daty</p>
      </div>
      <TextInput size="lg" label={label} aria-label={label} required type="date" min={today} value={value} error={error}
        onChange={event => {
          const next = event.currentTarget.value; onChange(next);
          if (isDateString(next) && next >= today) setMonth(`${next.slice(0, 7)}-01`);
        }} />
    </aside>
  );
}
