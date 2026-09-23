import "./temporal.ts";
import { dateToWareki } from "@smarthr/wareki";
import { DateTime } from "effect";
import { Temporal } from "temporal-polyfill";

const warekiOf = (gregorian: Date | string): string => {
  const wareki = dateToWareki(gregorian);
  return wareki.isValid ? wareki.result : wareki.formatted;
};

const formatWarekiDate = (gregorianInstant: Date): string => warekiOf(gregorianInstant);

const formatWarekiMonth = (yearMonth: string): string =>
  formatWarekiDate(DateTime.toDate(DateTime.makeUnsafe(`${yearMonth}-01T00:00:00Z`))).replace(
    /\d+日$/u,
    "",
  );

const displayTimeZone = "Asia/Tokyo";

const formatWarekiDateTime = (epochMilliseconds: number): string => {
  const zoned =
    Temporal.Instant.fromEpochMilliseconds(epochMilliseconds).toZonedDateTimeISO(displayTimeZone);
  const day = warekiOf(`${zoned.year}/${zoned.month}/${zoned.day}`);
  return `${day} ${zoned.toPlainTime().toString({ smallestUnit: "minute" })}`;
};

export { formatWarekiDate, formatWarekiDateTime, formatWarekiMonth };
