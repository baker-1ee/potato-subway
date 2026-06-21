export function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatHeaderDate(isoDate: string) {
  // "2026-06-07T00:00:00.000Z" 형태도 처리
  const dateOnly = isoDate.slice(0, 10);
  const [y, m, d] = dateOnly.split("-").map(Number);
  if (!y || !m || !d) return dateOnly;
  const dt = new Date(y, m - 1, d);
  const w = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getDay()];
  return `${dateOnly} (${w})`;
}

export function formatCommentTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
