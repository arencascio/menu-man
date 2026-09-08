import styles from "./restaurant-page.module.css";

export type BusinessHour = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  sort_order: number;
};

type BusinessHoursProps = {
  hours: BusinessHour[];
  timezone: string | null;
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(value: string | null) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date(Date.UTC(2020, 0, 5, hour, minute));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function BusinessHours({ hours, timezone }: BusinessHoursProps) {
  const grouped = dayNames.map((name, dayOfWeek) => ({
    name,
    intervals: hours
      .filter((hour) => hour.day_of_week === dayOfWeek)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <div className={styles.hours} aria-label={timezone ? `Hours in ${timezone}` : "Hours"}>
      <h2>Hours</h2>
      {grouped.map((day) => (
        <div className={styles.hourRow} key={day.name}>
          <span className={styles.hourDay}>{day.name}</span>
          <span>
            {day.intervals.length === 0 ? (
              <span className={styles.placeholderText}>Hours not provided</span>
            ) : day.intervals.every((interval) => interval.is_closed) ? (
              "Closed"
            ) : (
              day.intervals
                .filter((interval) => !interval.is_closed)
                .map((interval) => `${formatTime(interval.open_time)} - ${formatTime(interval.close_time)}`)
                .join(", ") || "Closed"
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
