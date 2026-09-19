const captchaPackages = [
  "@hcaptcha/react-hcaptcha",
  "@marsidev/react-turnstile",
  "grecaptcha",
  "react-google-recaptcha",
  "react-google-recaptcha-v3",
  "react-turnstile",
  "svelte-turnstile",
] as const;

const captchaImportPattern = new RegExp(
  String.raw`from\s+["'](?:${captchaPackages.map((name) => name.replaceAll("/", String.raw`\/`)).join("|")})(?:\/[^"']*)?["']|require\(\s*["'](?:${captchaPackages.map((name) => name.replaceAll("/", String.raw`\/`)).join("|")})(?:\/[^"']*)?["']\s*\)`,
  "u",
);

const browserConfirmPattern =
  /\b(?:window\.|globalThis\.)?confirm\s*\(|\b(?:window\.|globalThis\.)alert\s*\(/u;

const hoverHidden = /(?:^|[\s"'`])(?:opacity-0|invisible|hidden|pointer-events-none)(?:$|[\s"'`])/u;
const hoverReveal = /(?:group-hover|hover):(?:opacity-(?:100|\[1\])|visible|pointer-events-auto)/u;

const interactiveOpen = /<(?:button|Button|DropdownMenuTrigger|a\b|Link\b|ButtonLink\b)[\s>]/gu;

const namedControl = /\b(?:aria-label|aria-labelledby|title)\s*=|>([^<{][^<]*)</u;

const iconOnlyBody = /^[\s]*(?:<[\w.]+[^>]*\/?>[\s]*)*$/u;

const buttonMarkup = /<button\b([^>]*)>([\s\S]*?)<\/button>|<button\b([^>]*)\/>/gu;
const linkMarkup = /<a\b([^>]*)>([\s\S]*?)<\/a>/gu;
const ariaLabelAttr = /\baria-label\s*=\s*(?:\{`"([^`]*)"`\}|"([^"]*)"|'([^']*)')/u;
const liveRegionMarkup =
  /<(?:p|div|span)\b[^>]*\brole\s*=\s*(?:"|')(?:status|alert)(?:"|')[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gu;

type AccessibleNameCount = {
  readonly count: number;
  readonly name: string;
  readonly role: "button" | "link";
};

const captchaImportViolations = (source: string): string[] => {
  return captchaImportPattern.test(source)
    ? ["captcha-import: 画像認証は使えません。回数の上限と User-Agent で乱用を見てください。"]
    : [];
};

const browserConfirmViolations = (source: string): string[] => {
  return browserConfirmPattern.test(source)
    ? [
        "browser-confirm: window.confirm / alert は使えません。見出しと動作の名前を持つ ConfirmDialog を使ってください。",
      ]
    : [];
};

const hoverOnlyActionViolations = (source: string): string[] => {
  const classBlocks = [
    ...source.matchAll(/className\s*=\s*(?:\{`([^`]*)`\}|"([^"]*)"|'([^']*)')/gu),
  ];
  const hovering = classBlocks.some((match) => {
    const classes = match[1] ?? match[2] ?? match[3]!;
    return hoverHidden.test(classes) && hoverReveal.test(classes);
  });
  return hovering
    ? [
        "hover-only-action: ホバーでしか出ない操作は作れません。押せば出るメニュー（DropdownMenu）にしてください。",
      ]
    : [];
};

const unnamedControlViolations = (source: string): string[] => {
  const openings = [...source.matchAll(interactiveOpen)];
  return openings.flatMap((match) => {
    const after = source.slice(match.index);
    const selfClosing = /^<[^>]*\/>/u.exec(after)?.[0];
    const paired = /^<(\w+)[^>]*>([\s\S]*?)<\/\1>/u.exec(after);
    const element = selfClosing ?? paired?.[0];
    if (element === undefined || namedControl.test(element)) {
      return [];
    }
    const body = paired?.[2] ?? "";
    return selfClosing !== undefined || iconOnlyBody.test(body)
      ? [
          "unnamed-control: ボタンとリンクには一意の名前が要ります。文言か aria-label を付けてください。",
        ]
      : [];
  });
};

const urlHoldsScreenState = (href: string, paramNames: readonly string[]): boolean => {
  const pageUrl = new URL(href, "https://example.test/");
  return paramNames.every(
    (paramName) =>
      pageUrl.searchParams.has(paramName) ||
      pageUrl.hash.includes(`${paramName}=`) ||
      pageUrl.hash.includes(paramName),
  );
};

const stripTags = (markup: string): string => {
  return markup
    .replaceAll(/<[^>]+>/gu, "")
    .replaceAll(/\s+/gu, " ")
    .trim();
};

const accessibleNameFromMarkup = (attributes: string, body: string): string => {
  const aria = ariaLabelAttr.exec(attributes);
  const ariaLabel = aria?.[1] ?? aria?.[2] ?? aria?.[3] ?? "";
  return ariaLabel === "" ? stripTags(body) : ariaLabel;
};

const duplicateNamesInMarkup = (
  markup: string,
  pattern: RegExp,
  role: "button" | "link",
): AccessibleNameCount[] => {
  const accessibleNames = [...markup.matchAll(pattern)].map((match) => {
    const attributes = match[1] ?? match[3] ?? "";
    const body = match[2] ?? "";
    return accessibleNameFromMarkup(attributes, body);
  });
  const countsByName = accessibleNames.reduce<ReadonlyMap<string, number>>(
    (counts, accessibleName) => {
      if (accessibleName === "") {
        return counts;
      }
      return new Map([...counts, [accessibleName, (counts.get(accessibleName) ?? 0) + 1]]);
    },
    new Map(),
  );
  return [...countsByName.entries()]
    .filter(([, occurrences]) => occurrences > 1)
    .map(([accessibleName, occurrences]) => ({
      count: occurrences,
      name: accessibleName,
      role,
    }))
    .toSorted((left, right) => left.name.localeCompare(right.name));
};

const duplicateAccessibleNamesInMarkup = (markup: string): AccessibleNameCount[] => {
  return [
    ...duplicateNamesInMarkup(markup, buttonMarkup, "button"),
    ...duplicateNamesInMarkup(markup, linkMarkup, "link"),
  ];
};

const unnamedButtonsInMarkup = (markup: string): string[] => {
  return [...markup.matchAll(buttonMarkup)].flatMap((match, buttonIndex) => {
    const attributes = match[1] ?? match[3] ?? "";
    const body = match[2] ?? "";
    return accessibleNameFromMarkup(attributes, body) === ""
      ? [`button#${String(buttonIndex)}`]
      : [];
  });
};

const resultAnnouncedInMarkup = (markup: string, announced: string): boolean => {
  const liveLabels = [...markup.matchAll(liveRegionMarkup)].map((match) =>
    stripTags(match[1] ?? ""),
  );
  if (liveLabels.some((liveLabel) => liveLabel.includes(announced))) {
    return true;
  }
  return stripTags(markup).includes(announced);
};

const shippedUiRuleViolations = (source: string): string[] => {
  return [
    ...captchaImportViolations(source),
    ...browserConfirmViolations(source),
    ...hoverOnlyActionViolations(source),
  ];
};

const aiOperableUiViolations = (source: string): string[] => {
  return [...shippedUiRuleViolations(source), ...unnamedControlViolations(source)];
};

export {
  aiOperableUiViolations,
  browserConfirmViolations,
  captchaImportViolations,
  duplicateAccessibleNamesInMarkup,
  hoverOnlyActionViolations,
  resultAnnouncedInMarkup,
  shippedUiRuleViolations,
  unnamedButtonsInMarkup,
  unnamedControlViolations,
  urlHoldsScreenState,
};
