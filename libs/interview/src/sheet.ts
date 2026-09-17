import { Option, Schema } from "effect";

const maximumNickname = 30;
const maximumOccupation = 50;
const maximumInterest = 20;
const maximumInterests = 5;
const maximumArea = 50;
const maximumMessage = 200;
const maximumOption = 20;
const minimumOptions = 2;
const maximumOptions = 8;

function text(maximum: number): Schema.Trim {
  return Schema.Trim.check(Schema.isLengthBetween(1, maximum));
}

const interestCount = Schema.isLengthBetween(1, maximumInterests);
const valueSchemas = {
  area: text(maximumArea),
  interests: Schema.Array(text(maximumInterest)).check(interestCount),
  message: text(maximumMessage),
  nickname: text(maximumNickname),
  occupation: text(maximumOccupation),
};

const Sheet = Schema.Struct({
  area: Schema.optionalKey(valueSchemas.area),
  interests: Schema.optionalKey(valueSchemas.interests),
  message: Schema.optionalKey(valueSchemas.message),
  nickname: Schema.optionalKey(valueSchemas.nickname),
  occupation: Schema.optionalKey(valueSchemas.occupation),
});

const fieldKeys = ["nickname", "occupation", "interests", "area", "message"] as const;
const FieldKey = Schema.Literals(fieldKeys);

const optionCount = Schema.isLengthBetween(minimumOptions, maximumOptions);
const Options = Schema.Array(text(maximumOption)).check(optionCount);
const Reply = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("single"), options: Options }),
  Schema.Struct({ kind: Schema.Literal("multiple"), options: Options }),
  Schema.Struct({ kind: Schema.Literal("confirm") }),
]);

type SheetData = typeof Sheet.Type;
type FieldName = typeof FieldKey.Type;
type ReplyForm = typeof Reply.Type;

interface FieldDefinition {
  readonly label: string;
  readonly question: string;
  readonly reply?: ReplyForm;
}

const fieldDefinitions: Readonly<Record<FieldName, FieldDefinition>> = {
  area: {
    label: "活動エリア",
    question: "主にどのあたりで活動していますか？",
    reply: { kind: "single", options: ["東京", "大阪", "福岡", "オンライン中心"] },
  },
  interests: {
    label: "興味",
    question: "興味のあるものを教えてください。いくつでも選べます。",
    reply: { kind: "multiple", options: ["音楽", "キャンプ", "ゲーム", "料理", "読書"] },
  },
  message: { label: "ひとこと", question: "最後に、載せたいひとことをどうぞ。" },
  nickname: { label: "呼び名", question: "なんて呼べばいいですか？" },
  occupation: {
    label: "職種",
    question: "ふだんはどんなお仕事をしていますか？",
    reply: { kind: "single", options: ["エンジニア", "デザイナー", "営業", "学生"] },
  },
};

const separators = /[、,，]/u;
const Loose = Schema.Record(Schema.String, Schema.Unknown);
const decodeLoose = Schema.decodeUnknownOption(Loose);
const decodeSheet = Schema.decodeUnknownOption(Sheet);

type Decodable = Schema.Top & { readonly DecodingServices: never };
type LooseRecord = Readonly<Record<string, unknown>>;

function validEntries(
  input: unknown,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  schemas: Readonly<Record<string, Decodable>>,
): LooseRecord {
  const record = Option.getOrElse(decodeLoose(input), (): LooseRecord => ({}));
  const valid = Object.keys(schemas).filter((key) => {
    const schema = schemas[key];
    return schema !== undefined && Option.isSome(Schema.decodeUnknownOption(schema)(record[key]));
  });
  return Object.fromEntries(valid.map((key) => [key, record[key]]));
}

function readValues(input: unknown): SheetData {
  return Option.getOrElse(decodeSheet(validEntries(input, valueSchemas)), () => ({}));
}

function readValue(key: FieldName, spoken: readonly string[]): SheetData {
  const parts = spoken.flatMap((part) => part.split(separators));
  const candidate =
    key === "interests" ? parts.filter((part) => part.trim() !== "") : spoken.join("、");
  return readValues({ [key]: candidate });
}

function displayValue(sheet: SheetData, key: FieldName): string | undefined {
  const value = sheet[key];
  return typeof value === "string" || value === undefined ? value : value.join("、");
}

export {
  FieldKey,
  Reply,
  Sheet,
  displayValue,
  fieldDefinitions,
  fieldKeys,
  readValue,
  readValues,
  validEntries,
};
export type { FieldName, ReplyForm, SheetData };
