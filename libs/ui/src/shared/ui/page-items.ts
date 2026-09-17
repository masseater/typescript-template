import { range } from "es-toolkit";

type PageItem = Readonly<{ kind: "gap"; after: number }> | Readonly<{ kind: "page"; page: number }>;

const MAX_PAGES_WITHOUT_GAPS = 7;
const secondPage = 2;

function pages(first: number, last: number): PageItem[] {
  return range(first, last + 1).map((page) => ({ kind: "page", page }));
}

function pageItems({ current, last }: Readonly<{ current: number; last: number }>): PageItem[] {
  if (last <= MAX_PAGES_WITHOUT_GAPS) {
    return pages(1, last);
  }
  const windowEnd = Math.max(Math.min(last - 1, current + 1), secondPage + 1);
  const windowStart = Math.min(Math.max(secondPage, current - 1), last - secondPage);
  const start = windowStart === secondPage + 1 ? secondPage : windowStart;
  const end = windowEnd === last - secondPage ? last - 1 : windowEnd;
  return [
    ...pages(1, 1),
    ...(start > secondPage ? [{ after: 1, kind: "gap" } as const] : []),
    ...pages(start, end),
    ...(end < last - 1 ? [{ after: end, kind: "gap" } as const] : []),
    ...pages(last, last),
  ];
}

export { pageItems };
