import type { ReactElement } from "react";

function QueuedMessage({ text }: Readonly<{ text: string }>): ReactElement {
  return (
    <p className="ml-8 self-end rounded-lg border border-border px-3 py-2 whitespace-pre-wrap text-muted-foreground">
      {text}
      <span className="block text-sm">前の返事のあとに送ります</span>
    </p>
  );
}

export { QueuedMessage };
