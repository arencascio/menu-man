import styles from "./restaurant-hours-location.module.css";

export type BusinessHour = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  sort_order: number;
};

export type SpecialHour = {
  service_date: string;
  label: string | null;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
};

type BusinessHoursProps = {
  hours: readonly BusinessHour[];
  specialHours: readonly SpecialHour[];
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatInterval(openTime: string | null, closeTime: string | null) {
  if (!openTime || !closeTime) return "Closed";
  return `${formatTime(openTime)} - ${formatTime(closeTime)}`;
}

export default function BusinessHours({ hours, specialHours, timezone }: BusinessHoursProps) {
  const grouped = dayNames.map((name, dayOfWeek) => ({
    name,
    intervals: hours
      .filter((hour) => hour.day_of_week === dayOfWeek)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
  const hasPublishedHours = hours.some((hour) => (
    !hour.is_closed && Boolean(hour.open_time) && Boolean(hour.close_time)
  ));

  return (
    <div className={styles.hours} aria-label={timezone ? `Hours in ${timezone}` : "Hours"}>
      <div className={styles.hoursHeading}>
        <h3>Weekly hours</h3>
        {timezone ? <span className={styles.timezone}>{timezone.replaceAll("_", " ")}</span> : null}
      </div>
      {hasPublishedHours ? (
        <div className={styles.hourRows}>
          {grouped.map((day) => (
            <div className={styles.hourRow} key={day.name}>
              <span className={styles.hourDay}>{day.name}</span>
              <span className={styles.hourTimes}>
                {day.intervals.length === 0 || day.intervals.every((interval) => interval.is_closed)
                  ? "Closed"
                  : day.intervals
                      .filter((interval) => !interval.is_closed)
                      .map((interval) => formatInterval(interval.open_time, interval.close_time))
                      .join(", ") || "Closed"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.hoursUnavailable}>Weekly hours have not been published yet.</p>
      )}

      {specialHours.length > 0 ? (
        <div className={styles.specialHours}>
          <p className={styles.specialHoursTitle}>Upcoming special hours</p>
          <div className={styles.specialHourRows}>
            {specialHours.map((specialHour) => (
              <div className={styles.specialHourRow} key={specialHour.service_date}>
                <span className={styles.specialHourDate}>
                  {formatDate(specialHour.service_date)}
                  {specialHour.label ? <span className={styles.specialHourLabel}>{specialHour.label}</span> : null}
                </span>
                <span className={styles.specialHourTimes}>
                  {specialHour.is_closed
                    ? "Closed"
                    : formatInterval(specialHour.open_time, specialHour.close_time)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
