export const smarthrTokens: Readonly<Record<string, string>> = {
  "--white": "#fff",
  "--white-darken": "#f2f2f2",
  "--grey-5": "#f8f7f6",
  "--grey-6": "#f5f4f3",
  "--grey-7": "#f2f1f0",
  "--grey-9": "#edebe8",
  "--grey-9-darken": "#e2dfda",
  "--grey-20": "#d6d3d0",
  "--grey-30": "#c1bdb7",
  "--grey-65": "#706d65",
  "--grey-100": "#23221e",
  "--main": "#0077c7",
  "--main-darken": "#0068ae",
  "--link": "#0071c1",
  "--link-darken": "#005ea1",
  "--danger": "#e01e5a",
  "--danger-darken": "#ca1b51",
  "--warning-yellow": "#ffcc17",
  "--warning-yellow-darken": "#fcc500",
  "--green": "#0f7f85",
  "--transparency-15": "rgba(3, 3, 2, 0.15)",
  "--transparency-30": "rgba(3, 3, 2, 0.3)",
  "--transparency-50": "rgba(3, 3, 2, 0.5)",
  "--layer-0": "none",
  "--layer-1": "0 1px 2px 0 var(--transparency-30)",
  "--layer-2": "0 2px 4px 1px var(--transparency-30)",
  "--layer-3": "0 4px 8px 2px var(--transparency-30)",
  "--layer-4": "0 8px 16px 4px var(--transparency-30)",
  "--ring": "var(--main)",
  "--radius-sm": "4px",
  "--radius-md": "6px",
  "--radius-lg": "8px",
  "--text-2xs": "0.6666666666666666rem",
  "--text-xs": "0.75rem",
  "--text-sm": "0.8571428571428571rem",
  "--text-base": "1rem",
  "--text-lg": "1.2rem",
  "--text-xl": "1.5rem",
  "--text-2xl": "2rem",
  "--leading-tight": "1.25",
  "--leading-normal": "1.5",
  "--leading-relaxed": "1.75",
  "--font-sans": "system-ui, sans-serif",
};

export const untouchedTokens = ["--spacing"] as const;

function declarations(css: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) found.set(name, value.trim());
  }
  return found;
}

export function tokenViolations(css: string): string[] {
  const declared = declarations(css);
  return [
    ...Object.entries(smarthrTokens).flatMap(([name, value]) =>
      declared.get(name) === value
        ? []
        : [
            `${name} は smarthr-ui の ${value} を移植した値である必要があります（現在: ${declared.get(name) ?? "未定義"}）。`,
          ],
    ),
    ...untouchedTokens.flatMap((name) =>
      declared.has(name)
        ? [`${name} は Tailwind CSS の既定値のままにしてください（部品の寸法が崩れます）。`]
        : [],
    ),
  ];
}
