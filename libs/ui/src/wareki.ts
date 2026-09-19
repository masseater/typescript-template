import { dateToWareki } from "@smarthr/wareki";

function formatWarekiDate(value: Date): string {
  const converted = dateToWareki(value);
  return converted.isValid ? converted.result : converted.formatted;
}

function formatWarekiMonth(yearMonth: string): string {
  return formatWarekiDate(new Date(`${yearMonth}-01T00:00:00Z`)).replace(/\d+日$/u, "");
}

export { formatWarekiDate, formatWarekiMonth };
