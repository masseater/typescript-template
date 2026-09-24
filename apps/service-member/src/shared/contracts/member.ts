import { Email, memberRetentionDays, photoSlots, profileVisibilities } from "@repo/config";
import {
  Acknowledged,
  Identifier,
  IdentifierQuery,
  SearchKeyword,
  UserKeyword,
  laterPage,
  maximumKeywordLength,
  maximumNameLength,
  pageNumber,
} from "@repo/runtime/contracts";
import { Schema } from "effect";

import { Sheet } from "#shared/interview/sheet.ts";
import { ProfileLayout } from "#shared/profile-layout/schema.ts";

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

const PhotoSlot = Schema.Literals(photoSlots);
const PhotoVersion = Schema.NullOr(Schema.String.check(Schema.isPattern(/^[0-9a-f-]{1,64}$/u)));
const PhotoVersions = Schema.Struct({ company: PhotoVersion, face: PhotoVersion });

const ProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  photos: PhotoVersions,
  profile: Schema.String,
  socialLinks: SocialLinks,
});

const ProfileUpdate = Schema.Struct({
  name: Schema.Trim.check(Schema.isLengthBetween(1, maximumNameLength)),
  profile: Schema.String.check(Schema.isMaxLength(maximumProfileLength)),
  socialLinks: SocialLinks,
});

const VisibilityView = Schema.Struct({
  searchable: Schema.Boolean,
  visibility: Schema.Literals(profileVisibilities),
});

const PhotoQuery = Schema.Struct({ slot: PhotoSlot });

const PhotoView = Schema.Struct({ slot: PhotoSlot, version: PhotoVersion });

const MemberQuery = IdentifierQuery;

const MemberPhotoQuery = Schema.Struct({
  id: Identifier,
  slot: PhotoSlot,
  version: Schema.optionalKey(Schema.String),
});

const MemberView = Schema.Struct({
  blocked: Schema.optionalKey(Schema.Boolean),
  following: Schema.optionalKey(Schema.Boolean),
  id: Schema.String,
  joined: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}$/u)),
  name: Schema.String,
  photos: PhotoVersions,
  profile: Schema.String,
  profileLayout: ProfileLayout,
  sheet: Sheet,
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

const ContactAccepted = Acknowledged;

const LeaveRequest = Schema.Struct({ immediate: Schema.Boolean });

const LeaveAccepted = Acknowledged;

const RecoveryOfferAvailable = Schema.Struct({
  available: Schema.Literal(true),
  previousName: Schema.String,
});

const RecoveryOfferUnavailable = Schema.Struct({
  available: Schema.Literal(false),
});

const RecoveryOfferView = Schema.Union([RecoveryOfferAvailable, RecoveryOfferUnavailable]);

const RecoveryAccepted = Acknowledged;

const MemberReference = Schema.Struct({ id: Schema.String, name: Schema.String });

export {
  ContactAccepted,
  ContactSubmission,
  Identifier,
  LeaveAccepted,
  LeaveRequest,
  MemberList,
  MemberListQuery,
  MemberPhotoQuery,
  MemberQuery,
  MemberReference,
  MemberView,
  PhotoQuery,
  PhotoView,
  ProfileUpdate,
  ProfileView,
  RecoveryAccepted,
  RecoveryOfferView,
  SearchKeyword,
  VisibilityView,
  laterPage,
  maximumContactMessageLength,
  maximumContactNameLength,
  maximumKeywordLength,
  maximumMemberPage,
  maximumNameLength,
  maximumProfileLength,
  maximumSocialLinks,
  memberPageSize,
  memberRetentionDays,
  pageNumber,
};
