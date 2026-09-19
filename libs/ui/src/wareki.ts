import { dateToWareki } from "@smarthr/wareki";

const formatWarekiDate = (gregorianInstant: Date): string => {
  const wareki = dateToWareki(gregorianInstant);
  return wareki.isValid ? wareki.result : wareki.formatted;
};

const formatWarekiMonth = (yearMonth: string): string =>
  formatWarekiDate(new Date(`${yearMonth}-01T00:00:00Z`)).replace(/\d+日$/u, "");

export { formatWarekiDate, formatWarekiMonth };
