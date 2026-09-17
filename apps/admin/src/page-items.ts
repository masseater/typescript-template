import { range } from "es-toolkit";

type PageItem = Readonly<{ kind: "gap"; after: number }> | Readonly<{ kind: "page"; page: number }>;

const MAX_PAGES_WITHOUT_GAPS = 7;
const SECOND_PAGE = 2;

function pages(first: number, last: number): PageItem[] {
  return range(first, last + 1).map((page) => ({ kind: "page", page }));
}

function pageItems({ current, last }: Readonly<{ current: number; last: number }>): PageItem[] {
  if (last <= MAX_PAGES_WITHOUT_GAPS) {
    return pages(1, last);
  }
  const windowEnd = Math.max(Math.min(last - 1, current + 1), SECOND_PAGE + 1);
  const windowStart = Math.min(Math.max(SECOND_PAGE, current - 1), last - SECOND_PAGE);
  const start = windowStart === SECOND_PAGE + 1 ? SECOND_PAGE : windowStart;
  const end = windowEnd === last - SECOND_PAGE ? last - 1 : windowEnd;
  return [
    ...pages(1, 1),
    ...(start > SECOND_PAGE ? [{ after: 1, kind: "gap" } as const] : []),
    ...pages(start, end),
    ...(end < last - 1 ? [{ after: end, kind: "gap" } as const] : []),
    ...pages(last, last),
  ];
}

export { pageItems };
