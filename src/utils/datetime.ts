/**
 * Parsea "YYYY-MM-DD HH:MM" (o "YYYY-MM-DD H:MM") como hora LOCAL del servidor
 * (según utcOffsetHours, ej. -6 = México) y devuelve Date en UTC.
 * Así quien crea el evento pone su hora y Discord muestra a cada uno la suya.
 */
export function parseGuildLocalDateTime(
  dateTimeStr: string,
  utcOffsetHours: number,
): Date | null {
  const trimmed = dateTimeStr.trim();
  // Aceptar "2026-03-21 21:00" o "2026-03-21 9:00"
  const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const [, y, m, d, h, min] = match;
  const year = parseInt(y!, 10);
  const month = parseInt(m!, 10) - 1;
  const day = parseInt(d!, 10);
  const hour = parseInt(h!, 10);
  const minute = parseInt(min!, 10);

  if (month < 0 || month > 11 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  // Esa fecha/hora interpretada como "local" del servidor (utcOffsetHours)
  // → UTC = local - offset (en ms: restar offset horas)
  const localAsUtcMs = Date.UTC(year, month, day, hour, minute);
  const utcMs = localAsUtcMs - (utcOffsetHours * 3600 * 1000);
  return new Date(utcMs);
}

/** Formato YYYY-MM-DD */
const DATE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Parsea rango de fechas. dateEnd opcional → mismo día.
 * Formato: YYYY-MM-DD
 */
export function parseDateRange(dateStart: string, dateEnd?: string): DateRange | null {
  const startMatch = dateStart.trim().match(DATE_RE);
  if (!startMatch) return null;

  const [, y1, m1, d1] = startMatch;
  const year = parseInt(y1!, 10);
  const month = parseInt(m1!, 10) - 1;
  const dayStart = parseInt(d1!, 10);

  if (month < 0 || month > 11 || dayStart < 1 || dayStart > 31) return null;

  const start = new Date(Date.UTC(year, month, dayStart, 0, 0, 0));
  if (isNaN(start.getTime())) return null;

  let end: Date;
  if (dateEnd && dateEnd.trim()) {
    const endMatch = dateEnd.trim().match(DATE_RE);
    if (!endMatch) return null;
    const [, y2, m2, d2] = endMatch;
    const yearEnd = parseInt(y2!, 10);
    const monthEnd = parseInt(m2!, 10) - 1;
    const dayEnd = parseInt(d2!, 10);
    if (monthEnd < 0 || monthEnd > 11 || dayEnd < 1 || dayEnd > 31) return null;
    end = new Date(Date.UTC(yearEnd, monthEnd, dayEnd, 23, 59, 59));
    if (isNaN(end.getTime()) || end < start) return null;
  } else {
    end = new Date(start);
  }
  return { start, end };
}

export interface TimeRange {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

/**
 * Parsea horario "21-23" o "21:00-23:00" o "9:00-23:30"
 */
export function parseTimeRange(horarioStr: string): TimeRange | null {
  const trimmed = horarioStr.trim();
  // "21-23" o "21:00-23:00" o "9:00-23:30"
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*-\s*(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;

  const [, h1, m1, h2, m2] = match;
  const startHour = parseInt(h1!, 10);
  const startMinute = m1 ? parseInt(m1, 10) : 0;
  const endHour = parseInt(h2!, 10);
  const endMinute = m2 ? parseInt(m2, 10) : 0;

  if (
    startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59 ||
    endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59
  ) return null;

  return { startHour, startMinute, endHour, endMinute };
}

/**
 * Convierte fecha + hora local (según offset) a Date UTC.
 */
export function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  utcOffsetHours: number,
): Date {
  const localAsUtcMs = Date.UTC(year, month, day, hour, minute);
  const utcMs = localAsUtcMs - (utcOffsetHours * 3600 * 1000);
  return new Date(utcMs);
}

/**
 * Genera timestamps Unix (segundos) para cada día del rango a la hora de inicio.
 * Útil para el embed de Discord con <t:ts:F>.
 */
export function getDayTimestamps(
  dateStart: Date,
  dateEnd: Date,
  startHour: number,
  startMinute: number,
  utcOffsetHours: number,
): number[] {
  const timestamps: number[] = [];
  const current = new Date(dateStart);
  current.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(dateEnd);
  endDate.setUTCHours(0, 0, 0, 0);

  while (current <= endDate) {
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth();
    const day = current.getUTCDate();
    const utcDate = localToUtc(year, month, day, startHour, startMinute, utcOffsetHours);
    timestamps.push(Math.floor(utcDate.getTime() / 1000));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return timestamps;
}
