import { CreatedResource, Identifier, pageNumber } from "@repo/runtime/contracts";
import { Schema } from "effect";

const maximumBoardTitleLength = 100;
const maximumBoardBodyLength = 5000;
const maximumBoardPage = 1_000_000;
const boardThreadPageSize = 20;
const boardPostPageSize = 50;

const withdrawnAuthorName = "退会した会員";

const BoardAuthor = Schema.NullOr(
  Schema.Union([
    Schema.Struct({ id: Schema.String, name: Schema.String }),
    Schema.Struct({
      name: Schema.Literal(withdrawnAuthorName),
      withdrawn: Schema.Literal(true),
    }),
  ]),
);

const BoardThreadSummary = Schema.Struct({
  author: BoardAuthor,
  createdAt: Schema.Finite,
  id: Schema.String,
  lastPostedAt: Schema.Finite,
  postCount: Schema.Finite,
  title: Schema.String,
});

const BoardPostView = Schema.Struct({
  author: BoardAuthor,
  body: Schema.String,
  createdAt: Schema.Finite,
  id: Schema.String,
});

const BoardThreadListQuery = Schema.Struct({
  page: pageNumber({ fallback: 1, maximum: maximumBoardPage, minimum: 1 }),
});

const BoardThreadList = Schema.Struct({
  pageSize: Schema.Literal(boardThreadPageSize),
  threads: Schema.Array(BoardThreadSummary),
  total: Schema.Finite,
});

const BoardThreadQuery = Schema.Struct({
  id: Identifier,
  page: pageNumber({ fallback: 1, maximum: maximumBoardPage, minimum: 1 }),
});

const BoardThreadView = Schema.Struct({
  pageSize: Schema.Literal(boardPostPageSize),
  posts: Schema.Array(BoardPostView),
  thread: BoardThreadSummary,
  total: Schema.Finite,
});

const BoardBody = Schema.Trim.check(Schema.isLengthBetween(1, maximumBoardBodyLength));

const BoardThreadCreate = Schema.Struct({
  body: BoardBody,
  title: Schema.Trim.check(Schema.isLengthBetween(1, maximumBoardTitleLength)),
});

const BoardThreadCreated = CreatedResource;

const BoardPostCreate = Schema.Struct({ body: BoardBody, threadId: Identifier });

const BoardPostCreated = CreatedResource;

export {
  BoardPostCreate,
  BoardPostCreated,
  BoardThreadCreate,
  BoardThreadCreated,
  BoardThreadList,
  BoardThreadListQuery,
  BoardThreadQuery,
  BoardThreadSummary,
  BoardThreadView,
  boardPostPageSize,
  boardThreadPageSize,
  maximumBoardBodyLength,
  maximumBoardPage,
  maximumBoardTitleLength,
  withdrawnAuthorName,
};
