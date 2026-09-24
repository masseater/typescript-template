import { SchemaIssue } from "effect";

const WHOLE_BODY = "$";

const issueFormatter = SchemaIssue.makeFormatterStandardSchemaV1({
  leafHook: (issue) => issue._tag,
});

const schemaMismatches = (issue: SchemaIssue.Issue): readonly string[] =>
  issueFormatter(issue).issues.map((reported) => {
    const path = (reported.path ?? [])
      .map((segment) => (typeof segment === "object" ? String(segment.key) : String(segment)))
      .join(".");
    return `${path === "" ? WHOLE_BODY : path}:${reported.message}`;
  });

export { schemaMismatches };
