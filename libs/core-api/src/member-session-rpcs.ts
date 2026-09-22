import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { SessionIdentityMiddleware, SessionInvalid, SessionRequired } from "./session-identity.ts";
import { SessionRpcs } from "./session-rpcs.ts";

class MemberProfileNotFound extends Schema.TaggedError<MemberProfileNotFound>()(
  "MemberProfileNotFound",
  {},
) {}

class ApiKeyWriteForbidden extends Schema.TaggedError<ApiKeyWriteForbidden>()(
  "ApiKeyWriteForbidden",
  {},
) {}

const PhotoVersion = Schema.NullOr(Schema.String);
const PhotoVersions = Schema.Struct({ company: PhotoVersion, face: PhotoVersion });

const MemberProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  photos: PhotoVersions,
  profile: Schema.String,
  socialLinks: Schema.Array(Schema.String),
});

const MemberProfileUpdate = Schema.Struct({
  name: Schema.String,
  profile: Schema.String,
  socialLinks: Schema.Array(Schema.String),
});

const getMemberProfile = Rpc.make("getMemberProfile", {
  error: Schema.Union([MemberProfileNotFound, SessionRequired, SessionInvalid]),
  payload: {},
  success: MemberProfileView,
}).middleware(SessionIdentityMiddleware);

const updateMemberProfile = Rpc.make("updateMemberProfile", {
  error: Schema.Union([
    ApiKeyWriteForbidden,
    MemberProfileNotFound,
    SessionRequired,
    SessionInvalid,
  ]),
  payload: MemberProfileUpdate,
  success: MemberProfileView,
}).middleware(SessionIdentityMiddleware);

export class MemberSessionRpcs extends RpcGroup.make(getMemberProfile, updateMemberProfile).merge(
  SessionRpcs,
) {}

export {
  ApiKeyWriteForbidden,
  MemberProfileNotFound,
  MemberProfileUpdate,
  MemberProfileView,
  getMemberProfile,
  updateMemberProfile,
};
