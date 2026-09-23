import { range } from "es-toolkit";

const MAX_PAGES_WITHOUT_GAPS = 7;
const pagesKeptBesideAnEdge = 2;

type PageItem = Readonly<{ kind: "gap"; after: number }> | Readonly<{ kind: "page"; page: number }>;

const pages = (first: number, last: number): PageItem[] => {
  return range(first, last + 1).map((page) => ({ kind: "page", page }));
};

const pageItems = ({ current, last }: Readonly<{ current: number; last: number }>): PageItem[] => {
  if (last <= MAX_PAGES_WITHOUT_GAPS) {
    return pages(1, last);
  }
  const windowEnd = Math.max(Math.min(last - 1, current + 1), pagesKeptBesideAnEdge + 1);
  const windowStart = Math.min(
    Math.max(pagesKeptBesideAnEdge, current - 1),
    last - pagesKeptBesideAnEdge,
  );
  const start = windowStart === pagesKeptBesideAnEdge + 1 ? pagesKeptBesideAnEdge : windowStart;
  const end = windowEnd === last - pagesKeptBesideAnEdge ? last - 1 : windowEnd;
  return [
    ...pages(1, 1),
    ...(start > pagesKeptBesideAnEdge ? [{ after: 1, kind: "gap" } as const] : []),
    ...pages(start, end),
    ...(end < last - 1 ? [{ after: end, kind: "gap" } as const] : []),
    ...pages(last, last),
  ];
};

export { pageItems };
