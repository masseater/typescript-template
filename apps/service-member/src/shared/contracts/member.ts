import { Email } from "@repo/config";
import {
  IdentifierQuery,
  SearchKeyword,
  UserKeyword,
  laterPage,
  maximumKeywordLength,
  pageNumber,
} from "@repo/runtime/contracts";
import { Schema } from "effect";

const maximumNameLength = 100;
const maximumProfileLength = 2000;
const maximumSocialLinkLength = 2048;
const maximumSocialLinks = 10;
const maximumMemberPage = 1_000_000;
const memberPageSize = 24;
const maximumContactNameLength = 100;
const maximumContactMessageLength = 4000;

const SocialLink = Schema.String.check(
  Schema.isMaxLength(maximumSocialLinkLength),
  Schema.makeFilter(
    (value: string) => URL.parse(value)?.protocol === "https:" || "https URL required",
  ),
);
const SocialLinks = Schema.Array(SocialLink).check(Schema.isMaxLength(maximumSocialLinks));

const ProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  profile: Schema.String,
  socialLinks: SocialLinks,
});

const ProfileUpdate = Schema.Struct({
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumNameLength)),
  profile: Schema.String.check(Schema.isMaxLength(maximumProfileLength)),
  socialLinks: SocialLinks,
});

const MemberQuery = IdentifierQuery;

const MemberView = Schema.Struct({
  id: Schema.String,
  joined: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}$/u)),
  name: Schema.String,
  profile: Schema.String,
  socialLinks: SocialLinks,
});

const MemberListQuery = Schema.Struct({
  keyword: Schema.optionalKey(UserKeyword),
  page: pageNumber({ fallback: 1, maximum: maximumMemberPage, minimum: 1 }),
});

const MemberList = Schema.Struct({
  members: Schema.Array(MemberView),
  pageSize: Schema.Literal(memberPageSize),
  total: Schema.Finite,
});

const ContactSubmission = Schema.Struct({
  email: Email,
  message: Schema.Trim.check(Schema.isLengthBetween(1, maximumContactMessageLength)),
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumContactNameLength)),
});

const ContactAccepted = Schema.Struct({ ok: Schema.Literal(true) });

export {
  ContactAccepted,
  ContactSubmission,
  MemberList,
  MemberListQuery,
  MemberQuery,
  MemberView,
  ProfileUpdate,
  ProfileView,
  SearchKeyword,
  laterPage,
  maximumContactMessageLength,
  maximumContactNameLength,
  maximumKeywordLength,
  maximumMemberPage,
  maximumNameLength,
  maximumProfileLength,
  maximumSocialLinks,
  memberPageSize,
};
