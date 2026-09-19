import { declarations } from "./design-system.ts";

const hoverSuffix = "-hover";
const referenceDepth = 8;
const srgbThreshold = 0.03928;
const srgbSlope = 12.92;
const srgbOffset = 0.055;
const srgbScale = 1.055;
const srgbExponent = 2.4;
const redWeight = 0.2126;
const greenWeight = 0.7152;
const blueWeight = 0.0722;

const variablePattern = /^var\((?<name>--[\w-]+)\)$/u;

const resolvedColor = (
  declared: Readonly<ReadonlyMap<string, string>>,
  name: string,
  depth: number,
): string | undefined => {
  const value = declared.get(name);
  const reference = value === undefined ? undefined : variablePattern.exec(value)?.groups?.name;
  return reference === undefined || depth === 0
    ? value
    : resolvedColor(declared, reference, depth - 1);
};

const byteMaximum = 255;

const channel = (byte: number): number => {
  const value = byte / byteMaximum;
  return value <= srgbThreshold
    ? value / srgbSlope
    : ((value + srgbOffset) / srgbScale) ** srgbExponent;
};

const hexPattern = /^#(?<digits>(?:[\da-f]{3}|[\da-f]{6}))$/iu;

const hexChannels = 3;

const luminance = (color: string | undefined): number | undefined => {
  const digits = color === undefined ? undefined : hexPattern.exec(color)?.groups?.digits;
  if (digits === undefined) {
    return undefined;
  }
  const width = digits.length / hexChannels;
  return [redWeight, greenWeight, blueWeight]
    .map((weight: number, index: number) => {
      const digit = digits.slice(index * width, index * width + width);
      return weight * channel(Number.parseInt(digit.repeat(hexChannels - width), 16));
    })
    .reduce((total: number, weighted: number) => total + weighted, 0);
};

const hoverViolations = (css: string): string[] => {
  const declared = declarations(css);
  return [...declared.keys()]
    .filter((name) => name.endsWith(hoverSuffix))
    .flatMap((name) => {
      const resting = name.slice(0, -hoverSuffix.length);
      const hovered = luminance(resolvedColor(declared, name, referenceDepth));
      const base = luminance(resolvedColor(declared, resting, referenceDepth));
      if (hovered === undefined || base === undefined) {
        return [
          `${name} と ${resting} を色として解決できません。hover が暗いことを確かめられません。`,
        ];
      }
      return hovered < base
        ? []
        : [
            `${name} は ${resting} より明るいか同じです。hover は darken(0.05) 相当なので、暗い側のトークンを指してください。`,
          ];
    })
    .toSorted();
};

export { hoverViolations };
