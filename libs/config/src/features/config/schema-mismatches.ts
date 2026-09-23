import { SchemaIssue } from "effect";

const WHOLE_BODY = "$";

const issueFormatter = SchemaIssue.makeFormatterStandardSchemaV1({
  leafHook: (issue) => issue._tag,
});

function schemaMismatches(issue: SchemaIssue.Issue): readonly string[] {
  return issueFormatter(issue).issues.map((reported) => {
    const path = (reported.path ?? [])
      .map((key) => (typeof key === "object" ? String(key.key) : String(key)))
      .join(".");
    return `${path === "" ? WHOLE_BODY : path}:${reported.message}`;
  });
}

export { schemaMismatches };
