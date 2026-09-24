import { PlateElement, PlateLeaf } from "platejs/react";

import type { TermLinkElement } from "#shared/wiki-document/index.ts";
import type { TImageElement, TLinkElement, TListElement } from "platejs";
import type { PlateElementProps, PlateLeafProps, RenderNodeWrapper } from "platejs/react";
import type { ReactElement } from "react";

const nestedListIndent = 1.5;

function ImageElement(props: PlateElementProps<TImageElement>): ReactElement {
  const { children, element } = props;
  return (
    <PlateElement {...props}>
      <div contentEditable={false}>
        <img
          alt={typeof element["alt"] === "string" ? element["alt"] : ""}
          className="max-w-full rounded-md border border-border"
          src={element.url}
        />
      </div>
      {children}
    </PlateElement>
  );
}

function LinkElement(props: PlateElementProps<TLinkElement>): ReactElement {
  const { children, element } = props;
  return (
    <PlateElement
      {...props}
      as="a"
      attributes={{ ...props.attributes, href: element.url }}
      className="text-link underline"
    >
      {children}
    </PlateElement>
  );
}

function TermLink(props: PlateElementProps<TermLinkElement>): ReactElement {
  const { children, element } = props;
  return (
    <PlateElement {...props} as="span" className="text-link underline decoration-dotted">
      <span contentEditable={false}>{element.label ?? element.term}</span>
      {children}
    </PlateElement>
  );
}

function ParagraphElement(props: PlateElementProps): ReactElement {
  return <PlateElement {...props} as="p" className="my-2" />;
}

function SectionHeadingElement(props: PlateElementProps): ReactElement {
  return <PlateElement {...props} as="h2" className="mt-6 mb-2 text-lg font-bold" />;
}

function BlockHeadingElement(props: PlateElementProps): ReactElement {
  return <PlateElement {...props} as="h3" className="mt-4 mb-2 text-base font-bold" />;
}

function BlockquoteElement(props: PlateElementProps): ReactElement {
  return (
    <PlateElement
      {...props}
      as="blockquote"
      className="my-3 border-s-4 border-border ps-4 text-muted-foreground"
    />
  );
}

function CodeBlockElement(props: PlateElementProps): ReactElement {
  return (
    <PlateElement
      {...props}
      as="pre"
      className="my-3 overflow-x-auto rounded-md bg-muted p-3 font-mono text-sm"
    />
  );
}

function CodeLeaf(props: PlateLeafProps): ReactElement {
  return <PlateLeaf {...props} as="code" className="rounded-sm bg-muted px-1 font-mono text-sm" />;
}

function TableElement(props: PlateElementProps): ReactElement {
  const { attributes, children } = props;
  return (
    <PlateElement {...props} as="table" attributes={attributes} className="my-3 border-collapse">
      <tbody>{children}</tbody>
    </PlateElement>
  );
}

function TableRowElement(props: PlateElementProps): ReactElement {
  return <PlateElement {...props} as="tr" />;
}

function TableCellElement(props: PlateElementProps): ReactElement {
  return <PlateElement {...props} as="td" className="border border-border px-2 py-1 align-top" />;
}

function TableHeaderCellElement(props: PlateElementProps): ReactElement {
  return (
    <PlateElement
      {...props}
      as="th"
      className="border border-border bg-muted px-2 py-1 text-start align-top font-bold"
    />
  );
}

function ListItem({ children, element }: PlateElementProps): ReactElement {
  const { indent, listStart, listStyleType } = element as Partial<TListElement>;
  const List = listStyleType === "decimal" ? "ol" : "ul";
  return (
    <List
      className="m-0 ps-6"
      start={listStart}
      style={{
        listStyleType,
        marginInlineStart: `${((indent ?? 1) - 1) * nestedListIndent}rem`,
      }}
    >
      <li>{children}</li>
    </List>
  );
}

const renderListItem: RenderNodeWrapper = ({ element }) =>
  typeof element["listStyleType"] === "string" ? ListItem : undefined;

export {
  BlockHeadingElement,
  BlockquoteElement,
  CodeBlockElement,
  CodeLeaf,
  ImageElement,
  LinkElement,
  ParagraphElement,
  SectionHeadingElement,
  TableCellElement,
  TableElement,
  TableHeaderCellElement,
  TableRowElement,
  TermLink,
  renderListItem,
};
