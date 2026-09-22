import { UserNotFound } from "@repo/db";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { SessionIdentityMiddleware, SessionInvalid, SessionRequired } from "./session-identity.ts";

const maximumIdentifierLength = 256;
const maximumKeywordLength = 100;
const maximumListLimit = 100;
const PhotoVersion = Schema.NullOr(Schema.String);
const PhotoVersions = Schema.Struct({ company: PhotoVersion, face: PhotoVersion });

const blockKinds = [
  "actions",
  "biography",
  "identity",
  "joined",
  "sheet-area",
  "sheet-interests",
  "sheet-message",
  "sheet-nickname",
  "sheet-occupation",
  "social-links",
] as const;

const ProfileLayout = Schema.Struct({
  blocks: Schema.Array(Schema.Struct({ kind: Schema.Literals(blockKinds) })).check(
    Schema.isNonEmpty(),
  ),
});

const Sheet = Schema.Struct({
  area: Schema.optionalKey(Schema.String),
  interests: Schema.optionalKey(Schema.Array(Schema.String)),
  message: Schema.optionalKey(Schema.String),
  nickname: Schema.optionalKey(Schema.String),
  occupation: Schema.optionalKey(Schema.String),
});

const MemberDirectoryView = Schema.Struct({
  blocked: Schema.optionalKey(Schema.Boolean),
  following: Schema.optionalKey(Schema.Boolean),
  id: Schema.String,
  joined: Schema.String,
  name: Schema.String,
  photos: PhotoVersions,
  profile: Schema.String,
  profileLayout: ProfileLayout,
  sheet: Sheet,
  socialLinks: Schema.Array(Schema.String),
});

const MemberDirectoryList = Schema.Struct({
  members: Schema.Array(MemberDirectoryView),
  total: Schema.Finite,
});

const MemberDirectoryQuery = Schema.Struct({
  id: Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength)),
});

const MemberDirectoryListQuery = Schema.Struct({
  keyword: Schema.optionalKey(Schema.String.check(Schema.isLengthBetween(1, maximumKeywordLength))),
  limit: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ maximum: maximumListLimit, minimum: 1 }),
  ),
  offset: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ maximum: 1_000_000, minimum: 0 })),
});

const SessionError = Schema.Union([SessionRequired, SessionInvalid]);

const getMember = Rpc.make("getMember", {
  error: Schema.Union([UserNotFound, SessionRequired, SessionInvalid]),
  payload: MemberDirectoryQuery,
  success: MemberDirectoryView,
}).middleware(SessionIdentityMiddleware);

const listMembers = Rpc.make("listMembers", {
  error: SessionError,
  payload: MemberDirectoryListQuery,
  success: MemberDirectoryList,
}).middleware(SessionIdentityMiddleware);

export class MemberDirectoryRpcs extends RpcGroup.make(getMember, listMembers) {}

export {
  MemberDirectoryList,
  MemberDirectoryListQuery,
  MemberDirectoryQuery,
  MemberDirectoryView,
  getMember,
  listMembers,
  maximumListLimit,
};
