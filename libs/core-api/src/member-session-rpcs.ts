import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { SessionIdentityMiddleware, SessionIdentityView } from "./session-identity.ts";

class MemberProfileNotFound extends Schema.TaggedError<MemberProfileNotFound>()(
  "MemberProfileNotFound",
  {},
) {}

const MemberProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  profile: Schema.String,
  socialLinks: Schema.Array(Schema.String),
});

const MemberProfileUpdate = Schema.Struct({
  name: Schema.String,
  profile: Schema.String,
  socialLinks: Schema.Array(Schema.String),
});

const getSession = Rpc.make("getSession", {
  payload: {},
  success: SessionIdentityView,
}).middleware(SessionIdentityMiddleware);

const getMemberProfile = Rpc.make("getMemberProfile", {
  error: MemberProfileNotFound,
  payload: {},
  success: MemberProfileView,
}).middleware(SessionIdentityMiddleware);

const updateMemberProfile = Rpc.make("updateMemberProfile", {
  error: MemberProfileNotFound,
  payload: MemberProfileUpdate,
  success: MemberProfileView,
}).middleware(SessionIdentityMiddleware);

export class MemberSessionRpcs extends RpcGroup.make(
  getSession,
  getMemberProfile,
  updateMemberProfile,
) {}

export {
  MemberProfileNotFound,
  MemberProfileUpdate,
  MemberProfileView,
  getMemberProfile,
  getSession,
  updateMemberProfile,
};
