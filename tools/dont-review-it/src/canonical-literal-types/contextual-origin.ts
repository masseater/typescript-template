import * as ts from "typescript-6";

const propertyName = (assignment: ts.PropertyAssignment): string | null => {
  const { name } = assignment;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
};

const propertyHolder = (input: {
  readonly assignment: ts.PropertyAssignment;
  readonly checker: ts.TypeChecker;
}): ts.Symbol | undefined => {
  const held = propertyName(input.assignment);
  const objectType = input.checker.getContextualType(input.assignment.parent);
  return held === null || objectType === undefined
    ? undefined
    : input.checker.getPropertyOfType(objectType, held);
};

const argumentHolder = (input: {
  readonly call: ts.CallExpression | ts.NewExpression;
  readonly checker: ts.TypeChecker;
  readonly node: ts.Node;
}): ts.Symbol | undefined => {
  const position = [...(input.call.arguments ?? [])].indexOf(input.node as ts.Expression);
  if (position < 0) return undefined;
  return input.checker.getResolvedSignature(input.call)?.parameters[position];
};

export const contextualOriginSymbol = (input: {
  readonly checker: ts.TypeChecker;
  readonly contextualType: ts.Type;
  readonly node: ts.Node;
}): ts.Symbol | undefined => {
  const named = input.contextualType.aliasSymbol ?? input.contextualType.getSymbol();
  if (named !== undefined) return named;
  const { parent } = input.node;
  if (ts.isPropertyAssignment(parent) && ts.isObjectLiteralExpression(parent.parent)) {
    return propertyHolder({ assignment: parent, checker: input.checker });
  }
  return ts.isCallExpression(parent) || ts.isNewExpression(parent)
    ? argumentHolder({ call: parent, checker: input.checker, node: input.node })
    : undefined;
};

const DEPENDENCY_PATH_SEGMENT = "/node_modules/";

const isDependencySource = (input: {
  readonly program: ts.Program;
  readonly sourceFile: ts.SourceFile;
}): boolean =>
  input.program.isSourceFileDefaultLibrary(input.sourceFile) ||
  input.sourceFile.fileName.includes(DEPENDENCY_PATH_SEGMENT);

export const declaredOutsideRepository = (input: {
  readonly holder: ts.Symbol | undefined;
  readonly program: ts.Program;
}): boolean => {
  const declarations = input.holder?.getDeclarations() ?? [];
  return (
    declarations.length > 0 &&
    declarations.every((declaration) =>
      isDependencySource({
        program: input.program,
        sourceFile: declaration.getSourceFile(),
      }),
    )
  );
};
