import { useAtom, useAtomValue } from "@effect/atom-react";
import { type ReactElement } from "react";
import { Server as StyletronServer } from "styletron-engine-monolithic";

import { styleEngineAtom, styleSheetsAtom, styletronHydrateClass } from "./styletron-engine";

const sheetsMatch = (
  left: readonly Readonly<{ css: string; hydrate: string }>[],
  right: readonly Readonly<{ css: string; hydrate: string }>[],
): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (const [index, sheet] of left.entries()) {
    const paired = right[index];
    if (paired === undefined || sheet.css !== paired.css || sheet.hydrate !== paired.hydrate) {
      return false;
    }
  }
  return true;
};

const StyletronSheets = ({ slotId }: Readonly<{ slotId: string }>): ReactElement => {
  const engine = useAtomValue(styleEngineAtom(slotId));
  const [sheets, setSheets] = useAtom(styleSheetsAtom(slotId));
  const rendered =
    engine instanceof StyletronServer
      ? engine.getStylesheets().map((sheet) => {
          return {
            css: sheet.css,
            hydrate: sheet.attrs["data-hydrate"] ?? "",
          };
        })
      : sheets;
  if (engine instanceof StyletronServer && !sheetsMatch(sheets, rendered)) {
    setSheets(rendered);
  }
  return (
    <>
      {rendered.map((sheet) => (
        <style className={styletronHydrateClass} data-hydrate={sheet.hydrate} key={sheet.hydrate}>
          {sheet.css}
        </style>
      ))}
    </>
  );
};

export { StyletronSheets };
