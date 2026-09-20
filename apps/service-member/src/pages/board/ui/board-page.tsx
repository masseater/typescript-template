import { ButtonLink, PageNavigation, TextLink } from "@repo/ui";

import { BoardBody } from "./board-body.tsx";
import { BoardPageLink } from "./board-page-link.tsx";
import { NewThreadForm } from "./new-thread-form.tsx";
import { ThreadRow } from "./thread-row.tsx";

import type { ThreadList } from "#pages/board/api/board.ts";
import type { BoardSearch } from "#pages/board/model/board-search.ts";
import type { PageTarget } from "@repo/ui";
import type { ReactElement } from "react";

function pageLink(target: PageTarget): ReactElement {
  return <BoardPageLink target={target} />;
}

function Threads({ list, page }: Readonly<{ list: ThreadList; page: number }>): ReactElement {
  if (list.total === 0) {
    return <p className="text-base leading-normal">まだスレッドはありません。</p>;
  }
  if (list.threads.length === 0) {
    return (
      <p className="text-base leading-normal">
        このページにスレッドはありません。
        <TextLink to="/board" search={{}}>
          1 ページ目へ
        </TextLink>
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {list.threads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} />
        ))}
      </ul>
      <PageNavigation
        current={page}
        last={Math.ceil(list.total / list.pageSize)}
        renderLink={pageLink}
      />
    </>
  );
}

function BoardPage({
  list,
  search,
}: Readonly<{ list: ThreadList; search: BoardSearch }>): ReactElement {
  return (
    <BoardBody>
      {search.new === true ? (
        <NewThreadForm />
      ) : (
        <div>
          <ButtonLink to="/board" search={{ new: true }} variant="primary">
            新しいスレッド
          </ButtonLink>
        </div>
      )}
      <Threads list={list} page={search.page ?? 1} />
    </BoardBody>
  );
}

export { BoardPage };
