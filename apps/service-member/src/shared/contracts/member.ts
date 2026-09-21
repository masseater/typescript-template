import { Email, photoSlots, profileVisibilities } from "@repo/config";
import { Effect, Schema, SchemaGetter } from "effect";

const maximumIdentifierLength = 256;
const maximumNameLength = 100;
const maximumProfileLength = 2000;
const maximumSocialLinkLength = 2048;
const maximumSocialLinks = 10;
const maximumKeywordLength = 100;
const secondPage = 2;
const maximumMemberPage = 1_000_000;
const memberPageSize = 24;
const memberRetentionDays = 30;
const maximumContactNameLength = 100;
const maximumContactMessageLength = 4000;

const Identifier = Schema.String.check(Schema.isLengthBetween(1, maximumIdentifierLength));

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

const MemberQuery = Schema.Struct({ id: Identifier });

const MemberPhotoQuery = Schema.Struct({
  id: Identifier,
  slot: PhotoSlot,
  version: Schema.optionalKey(Schema.String),
});

const MemberView = Schema.Struct({
  id: Schema.String,
  joined: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}$/u)),
  name: Schema.String,
  photos: PhotoVersions,
  profile: Schema.String,
  socialLinks: SocialLinks,
});

function pageNumber(
  fallback: number,
  minimum: number,
  maximum: number,
): Schema.withDecodingDefaultKey<Schema.NumberFromString> {
  const range = Schema.isBetween({ maximum, minimum });
  const bounded = Schema.NumberFromString.check(Schema.isInt(), range);
  const fallbackText = Effect.succeed(String(fallback));
  return bounded.pipe(Schema.withDecodingDefaultKey(fallbackText));
}

const UserKeyword = Schema.Trim.check(Schema.isLengthBetween(1, maximumKeywordLength));
const JsonScalar = Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null]);
const ScalarText = JsonScalar.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform<string, string | number | boolean | null>(String),
    encode: SchemaGetter.transform((text: string) => text),
  }),
);
const SearchKeyword = ScalarText.pipe(Schema.decodeTo(UserKeyword));

function laterPage(maximum: number): Schema.Codec<number, number | string> {
  return Schema.Union([Schema.Number, Schema.NumberFromString]).check(
    Schema.isInt(),
    Schema.isBetween({ maximum, minimum: secondPage }),
  );
}

const MemberListQuery = Schema.Struct({
  keyword: Schema.optionalKey(UserKeyword),
  page: pageNumber(1, 1, maximumMemberPage),
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

const LeaveRequest = Schema.Struct({ immediate: Schema.Boolean });

const LeaveAccepted = Schema.Struct({ ok: Schema.Literal(true) });

const RecoveryOfferAvailable = Schema.Struct({
  available: Schema.Literal(true),
  previousName: Schema.String,
});

const RecoveryOfferUnavailable = Schema.Struct({
  available: Schema.Literal(false),
});

const RecoveryOfferView = Schema.Union([RecoveryOfferAvailable, RecoveryOfferUnavailable]);

const RecoveryAccepted = Schema.Struct({ ok: Schema.Literal(true) });

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
