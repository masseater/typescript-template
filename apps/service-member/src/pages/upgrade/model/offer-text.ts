import type { Offer } from "#pages/upgrade/api/checkout.ts";

const zeroDecimalCurrencies: ReadonlySet<string> = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);
const minorUnitsPerMajor = 100;

const intervalNames: Readonly<Record<Offer["interval"], string>> = {
  day: "日",
  month: "か月",
  week: "週",
  year: "年",
};

const singleIntervalNames: Readonly<Record<Offer["interval"], string>> = {
  day: "日額",
  month: "月額",
  week: "週額",
  year: "年額",
};

function formatAmount(offer: Offer): string {
  const currency = offer.currency.toLowerCase();
  const amount = zeroDecimalCurrencies.has(currency)
    ? offer.unitAmount
    : offer.unitAmount / minorUnitsPerMajor;
  return new Intl.NumberFormat("ja-JP", {
    currency: currency.toUpperCase(),
    style: "currency",
  }).format(amount);
}

function describeOffer(offer: Offer): string {
  const amount = formatAmount(offer);
  return offer.intervalCount === 1
    ? `${singleIntervalNames[offer.interval]} ${amount}`
    : `${offer.intervalCount}${intervalNames[offer.interval]}ごと ${amount}`;
}

export { describeOffer };
