import { createDontReviewItRule } from "../../../../create-rule.ts";

import type { ESTree } from "@oxlint/plugins";

type BoundMethod = "max" | "min";

const isIdentifierNamed = (node: ESTree.Node, name: string): boolean =>
  node.type === "Identifier" && node.name === name;

const OPPOSITE_BOUND: Readonly<Record<BoundMethod, BoundMethod>> = { max: "min", min: "max" };

const isMathMember = (callee: ESTree.Node): callee is ESTree.MemberExpression =>
  callee.type === "MemberExpression" &&
  !callee.computed &&
  !callee.optional &&
  isIdentifierNamed(callee.object, "Math");

const mathBoundOf = (node: ESTree.Node): BoundMethod | null => {
  if (node.type !== "CallExpression" || node.optional || node.arguments.length !== 2) return null;
  if (!isMathMember(node.callee) || node.callee.property.type !== "Identifier") return null;
  const { name } = node.callee.property;
  return name === "max" || name === "min" ? name : null;
};

const isNestedClamp = (node: ESTree.CallExpression): boolean => {
  const outer = mathBoundOf(node);
  if (outer === null) return false;
  return node.arguments.some((argument) => mathBoundOf(argument) === OPPOSITE_BOUND[outer]);
};

const returnedExpressionOf = (
  reducer: ESTree.ArrowFunctionExpression | ESTree.Function,
): ESTree.Node | null => {
  const written = reducer.body as ESTree.FunctionBody | ESTree.Expression | null;
  if (written === null) return null;
  if (written.type !== "BlockStatement") return written;
  if (written.body.length !== 1) return null;
  const [statement] = written.body;
  return statement?.type === "ReturnStatement" ? statement.argument : null;
};

const addsOntoAccumulator = (
  reducer: ESTree.ArrowFunctionExpression | ESTree.Function,
): boolean => {
  const [accumulator] = reducer.params;
  if (accumulator?.type !== "Identifier") return false;
  const returned = returnedExpressionOf(reducer);
  if (returned?.type !== "BinaryExpression" || returned.operator !== "+") return false;
  return (
    isIdentifierNamed(returned.left, accumulator.name) ||
    isIdentifierNamed(returned.right, accumulator.name)
  );
};

const isTextSeed = (seed: ESTree.Node): boolean =>
  seed.type === "TemplateLiteral" || (seed.type === "Literal" && typeof seed.value === "string");

const isReduceCall = (node: ESTree.CallExpression): boolean =>
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  isIdentifierNamed(node.callee.property, "reduce") &&
  node.arguments.length === 2;

const isInlineReducer = (
  node: ESTree.Node | undefined,
): node is ESTree.ArrowFunctionExpression | ESTree.Function =>
  node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";

const isHandRolledSum = (node: ESTree.CallExpression): boolean => {
  if (!isReduceCall(node)) return false;
  const [reducer, seed] = node.arguments;
  if (seed === undefined || isTextSeed(seed)) return false;
  return isInlineReducer(reducer) && addsOntoAccumulator(reducer);
};

export const noHandRolledSumOrClamp = createDontReviewItRule({
  name: "no-hand-rolled-sum-or-clamp--use-es-toolkit",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a `reduce` whose callback only adds each element onto the accumulator and a `Math.min` nested in `Math.max` or the reverse, so a total is written with `sum` or `sumBy` and a bound with `clamp` from es-toolkit instead of being rebuilt at each call site",
      relatedGuidelines: [".claude/skills/reviews/references/ownership-and-duplication.md"],
    },
    messages: {
      handRolledSum:
        'A total must not be built by a `reduce` that adds each element onto the accumulator. Write `sum(values)` or `sumBy(items, (item) => item.count)` from "es-toolkit", and add a starting value other than 0 outside the call.',
      handRolledClamp:
        'A value must not be bounded by nesting `Math.min` and `Math.max`. Write `clamp(value, minimum, maximum)` from "es-toolkit".',
    },
    schema: [],
  },
  create(inspection) {
    return {
      CallExpression(node: ESTree.CallExpression) {
        if (isHandRolledSum(node)) {
          inspection.report({ node, messageId: "handRolledSum" });
          return;
        }
        if (isNestedClamp(node)) inspection.report({ node, messageId: "handRolledClamp" });
      },
    };
  },
});
