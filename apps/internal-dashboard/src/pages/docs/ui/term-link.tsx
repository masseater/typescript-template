"use client";

import Link from "fumadocs-core/link";
import { useId, useState } from "react";

import { findGlossaryTerm } from "#shared/content/index.ts";
import { useGlossaryTerms } from "./glossary-terms-provider.tsx";

import type { ReactElement } from "react";

function TermLink({ label, term }: Readonly<{ label?: string; term: string }>): ReactElement {
  const terms = useGlossaryTerms();
  const entry = findGlossaryTerm(terms, term);
  const text = label ?? term;
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  if (entry === undefined) {
    return (
      <span
        className="bg-fd-muted text-fd-muted-foreground rounded-sm px-1"
        title="用語集にまだ無い用語"
      >
        {text}
      </span>
    );
  }
  return (
    <span
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onFocus={() => {
        setOpen(true);
      }}
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
      }}
    >
      <Link
        href={entry.href}
        className="bg-fd-primary/10 text-fd-primary rounded-sm px-0.5 font-medium underline decoration-dotted underline-offset-4"
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => {
          setOpen(false);
        }}
      >
        {text}
      </Link>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="border-fd-border bg-fd-popover text-fd-popover-foreground absolute bottom-[calc(100%+0.4rem)] left-1/2 z-20 w-64 -translate-x-1/2 rounded-md border p-3 text-left text-sm shadow-md"
        >
          <span className="text-fd-foreground block font-medium">{entry.name}</span>
          <span className="text-fd-muted-foreground mt-1 block">{entry.description}</span>
          <span className="text-fd-primary mt-2 block text-xs">用語のページを開く</span>
        </span>
      ) : undefined}
    </span>
  );
}

export { TermLink };
