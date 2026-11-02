import { Option } from "effect";
import ts from "typescript";
import type { Context, Location, Range } from "vite-plus/lint/plugins";

interface RangedNode {
  readonly range: Readonly<Range>;
}

interface MappedNode {
  readonly type: string;
  readonly range: Readonly<Range>;
  readonly loc: Location;
}

interface ParserServices {
  readonly program: ts.Program;
  readonly esTreeNodeToTSNodeMap: { readonly get: (node: RangedNode) => ts.Node };
  readonly tsNodeToESTreeNodeMap: { readonly get: (node: ts.Node) => MappedNode | undefined };
}

interface FileProgram {
  readonly context: Context;
  readonly program: ts.Program;
  readonly sourceFile: ts.SourceFile;
}

const covers = (node: ts.Node, sourceFile: ts.SourceFile, [start, end]: Readonly<Range>): boolean =>
  node.getStart(sourceFile) <= start && node.end >= end;

const spans = (node: ts.Node, sourceFile: ts.SourceFile, [start, end]: Readonly<Range>): boolean =>
  node.getStart(sourceFile) === start && node.end === end;

const innermostSpanning = (sourceFile: ts.SourceFile, range: Readonly<Range>): ts.Node => {
  const visit = (node: ts.Node, found: ts.Node): ts.Node => {
    if (!covers(node, sourceFile, range)) {
      return found;
    }
    const matched = Option.liftPredicate(node, (candidate) =>
      spans(candidate, sourceFile, range),
    ).pipe(Option.getOrElse(() => found));
    return Option.fromNullishOr(
      ts.forEachChild(node, (child) =>
        Option.liftPredicate(visit(child, matched), (deeper) => deeper !== matched).pipe(
          Option.getOrUndefined,
        ),
      ),
    ).pipe(Option.getOrElse(() => matched));
  };
  return visit(sourceFile, sourceFile);
};

const toMappedNode = ({ context, sourceFile }: FileProgram, node: ts.Node): MappedNode => {
  const start = node.getStart(sourceFile);
  return {
    type: ts.SyntaxKind[node.kind],
    range: [start, node.end],
    loc: {
      start: context.sourceCode.getLocFromIndex(start),
      end: context.sourceCode.getLocFromIndex(node.end),
    },
  };
};

const createParserServices = (file: FileProgram): ParserServices => {
  const toTs = new WeakMap<RangedNode, ts.Node>();
  return {
    program: file.program,
    esTreeNodeToTSNodeMap: {
      get: (node) =>
        Option.fromNullishOr(toTs.get(node)).pipe(
          Option.getOrElse(() => {
            const found = innermostSpanning(file.sourceFile, node.range);
            toTs.set(node, found);
            return found;
          }),
        ),
    },
    tsNodeToESTreeNodeMap: {
      get: (node) =>
        Option.liftPredicate(
          node,
          (candidate) => candidate.getSourceFile().fileName === file.sourceFile.fileName,
        ).pipe(
          Option.map((candidate) => toMappedNode(file, candidate)),
          Option.getOrUndefined,
        ),
    },
  };
};

export { createParserServices };
export type { FileProgram, MappedNode, ParserServices, RangedNode };
