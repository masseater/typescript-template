import {
  BasicBlocksPlugin,
  BasicMarksPlugin,
  BlockquotePlugin,
  CodePlugin,
  H2Plugin,
  H3Plugin,
} from "@platejs/basic-nodes/react";
import { CodeBlockPlugin } from "@platejs/code-block/react";
import { LinkPlugin } from "@platejs/link/react";
import { ListPlugin } from "@platejs/list/react";
import { ImagePlugin } from "@platejs/media/react";
import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from "@platejs/table/react";
import { ParagraphPlugin, createPlatePlugin } from "platejs/react";

import { TERM_LINK, wikiMarkdownPlugin } from "#shared/wiki-document/index.ts";
import {
  BlockHeadingElement,
  BlockquoteElement,
  CodeBlockElement,
  CodeLeaf,
  ImageElement,
  LinkElement,
  ListItem,
  ParagraphElement,
  SectionHeadingElement,
  TableCellElement,
  TableElement,
  TableHeaderCellElement,
  TableRowElement,
  TermLink,
} from "./wiki-editor-elements.tsx";

import type { NodeComponents } from "platejs";
import type { RenderNodeWrapper } from "platejs/react";

const renderListItem: RenderNodeWrapper = ({ element }) =>
  typeof element["listStyleType"] === "string" ? ListItem : undefined;

const TermLinkPlugin = createPlatePlugin({
  key: TERM_LINK,
  node: { component: TermLink, isElement: true, isInline: true, isVoid: true },
});

const wikiEditorPlugins = [
  BasicBlocksPlugin,
  BasicMarksPlugin,
  CodeBlockPlugin,
  ImagePlugin.withComponent(ImageElement),
  LinkPlugin.withComponent(LinkElement),
  ListPlugin.configure({ render: { belowNodes: renderListItem } }),
  ParagraphPlugin.withComponent(ParagraphElement),
  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableHeaderCellElement),
  TermLinkPlugin,
  wikiMarkdownPlugin,
];

const wikiEditorComponents: NodeComponents = {
  [BlockquotePlugin.key]: BlockquoteElement,
  [CodeBlockPlugin.key]: CodeBlockElement,
  [CodePlugin.key]: CodeLeaf,
  [H2Plugin.key]: SectionHeadingElement,
  [H3Plugin.key]: BlockHeadingElement,
};

export { wikiEditorComponents, wikiEditorPlugins };
