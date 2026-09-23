import { BaseBasicBlocksPlugin, BaseBasicMarksPlugin } from "@platejs/basic-nodes";
import { BaseCodeBlockPlugin } from "@platejs/code-block";
import { BaseLinkPlugin } from "@platejs/link";
import { BaseListPlugin } from "@platejs/list";
import { MarkdownPlugin, defaultRules } from "@platejs/markdown";
import { BaseImagePlugin } from "@platejs/media";
import { BaseTablePlugin } from "@platejs/table";
import { remarkWikiTerm, wikiTermSyntax } from "@repo/wiki-markdown";
import { Effect, Schema } from "effect";
import { createSlateEditor, createSlatePlugin } from "platejs";
import * as markdownPrinter from "prettier/plugins/markdown";
import { format } from "prettier/standalone";
import remarkGfm from "remark-gfm";
import { stringify } from "yaml";

import { readWikiFrontmatter } from "./wiki-frontmatter.ts";

import type { MdRules, SerializeMdOptions } from "@platejs/markdown";
import type { Html } from "mdast";
import type { TElement, TLinkElement, Value } from "platejs";

const TERM_LINK = "term_link";

type TermLinkElement = TElement &
  Readonly<{
    label?: string;
    term: string;
    type: typeof TERM_LINK;
  }>;

const TermLinkPlugin = createSlatePlugin({
  key: TERM_LINK,
  node: { isElement: true, isInline: true, isVoid: true },
});

const isStringAttribute = Schema.is(
  Schema.Struct({
    name: Schema.String,
    type: Schema.Literal("mdxJsxAttribute"),
    value: Schema.String,
  }),
);

function termLinkElement(attributes: readonly unknown[]): TermLinkElement {
  const strings = attributes.filter((attribute) => isStringAttribute(attribute));
  const term = strings.find((attribute) => attribute.name === "term")?.value ?? "";
  const label = strings.find((attribute) => attribute.name === "label")?.value;
  return {
    children: [{ text: "" }],
    term,
    type: TERM_LINK,
    ...(label === undefined ? {} : { label }),
  };
}

function emailOf(node: Readonly<TLinkElement>): string | undefined {
  const [only, ...rest] = node.children;
  return rest.length === 0 &&
    only !== undefined &&
    Object.keys(only).length === 1 &&
    typeof only.text === "string" &&
    node.url === `mailto:${only.text}`
    ? only.text
    : undefined;
}

const linkRules: Readonly<Record<string, NonNullable<MdRules[string]>>> = {
  a: {
    ...defaultRules.a,
    serialize: (node: TLinkElement, options: SerializeMdOptions) => {
      const email = emailOf(node);
      return email === undefined
        ? defaultRules.a?.serialize?.(node, options)
        : { type: "html", value: email };
    },
  },
};

const rules: MdRules = {
  ...linkRules,
  TermLink: {
    deserialize: (node: Readonly<{ attributes: readonly unknown[] }>) =>
      termLinkElement(node.attributes),
  },
  [TERM_LINK]: {
    serialize: (node: TermLinkElement): Html => ({
      type: "html",
      value: wikiTermSyntax(node.term, node.label),
    }),
  },
};

const wikiMarkdownPlugin = MarkdownPlugin.configure({
  options: { remarkPlugins: [remarkGfm, remarkWikiTerm], rules },
});

const markdownEditor = createSlateEditor({
  plugins: [
    BaseBasicBlocksPlugin,
    BaseBasicMarksPlugin,
    BaseCodeBlockPlugin,
    BaseImagePlugin,
    BaseLinkPlugin,
    BaseListPlugin,
    BaseTablePlugin,
    TermLinkPlugin,
    wikiMarkdownPlugin,
  ],
});

const zeroWidthSpace = String.fromCodePoint(0x20_0b);
type WikiDocument = Readonly<{
  description: string;
  title: string;
  value: Value;
}>;

const readWikiDocument = Effect.fn("readWikiDocument")(function* readWikiDocument(source: string) {
  const { body, description, title } = yield* readWikiFrontmatter(source);
  const document: WikiDocument = {
    description,
    title,
    value: markdownEditor.api.markdown.deserialize(body, { withoutMdx: true }),
  };
  return document;
});

function writeWikiDocument(document: WikiDocument): Effect.Effect<string> {
  const body = markdownEditor.api.markdown
    .serialize({
      remarkStringifyOptions: { bullet: "-" },
      value: [...document.value],
    })
    .replaceAll(zeroWidthSpace, "");
  const frontmatter = stringify(
    { title: document.title, description: document.description },
    { lineWidth: 0 },
  );
  return Effect.promise(() =>
    format(`---\n${frontmatter}---\n\n${body}`, {
      parser: "markdown",
      plugins: [markdownPrinter],
      printWidth: 100,
      proseWrap: "never",
    }),
  );
}

export { TERM_LINK, readWikiDocument, wikiMarkdownPlugin, writeWikiDocument };
export type { TermLinkElement, WikiDocument };
