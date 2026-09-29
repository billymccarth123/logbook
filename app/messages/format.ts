// Time labels for chat, in Irish time. Worked out on the server and passed to
// the client, so the browser and server always show the same text.
const TIME_ZONE = "Europe/Dublin";

const time = new Intl.DateTimeFormat("en-IE", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const weekday = new Intl.DateTimeFormat("en-IE", { weekday: "short", timeZone: TIME_ZONE });
const shortDate = new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short", timeZone: TIME_ZONE });
const longDay = new Intl.DateTimeFormat("en-IE", { weekday: "short", day: "numeric", month: "short", timeZone: TIME_ZONE });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }); // YYYY-MM-DD

function daysAgo(iso: string, now = new Date()) {
  const day = (date: Date) => Date.parse(dayKey.format(date));
  return Math.round((day(now) - day(new Date(iso))) / 86_400_000);
}

export function messageTime(iso: string) {
  return time.format(new Date(iso));
}

// "Today", "Yesterday" or "Mon 28 Sept", for the separators in a chat.
export function messageDay(iso: string) {
  const ago = daysAgo(iso);
  if (ago === 0) return "Today";
  if (ago === 1) return "Yesterday";
  return longDay.format(new Date(iso));
}

// "14:32", "Yesterday", "Mon" or "12 Sept", for the conversation list.
export function listTime(iso: string) {
  const ago = daysAgo(iso);
  if (ago === 0) return messageTime(iso);
  if (ago === 1) return "Yesterday";
  if (ago < 7) return weekday.format(new Date(iso));
  return shortDate.format(new Date(iso));
}
