import { TextLink } from "@repo/ui";

import { unavailableAuthor } from "#pages/board/model/author-labels.ts";

import type { BoardThreadSummary } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function AuthorName({
  author,
  linked,
}: Readonly<{
  author: (typeof BoardThreadSummary.Type)["author"];
  linked: boolean;
}>): ReactElement {
  if (author === null) {
    return <span className="text-muted-foreground">{unavailableAuthor}</span>;
  }
  if ("withdrawn" in author) {
    return <span className="text-muted-foreground">{author.name}</span>;
  }
  if (!linked) {
    return <span>{author.name}</span>;
  }
  return (
    <TextLink to="/users/$id" params={{ id: author.id }}>
      {author.name}
    </TextLink>
  );
}

export { AuthorName };
