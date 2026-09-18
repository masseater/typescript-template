import { createDontReviewItRule } from "../../../../create-rule.ts";
import { staticMemberOf } from "../../lib/static-member.ts";
import { hasWrittenOutText } from "../../lib/written-out-text.ts";

import type { ESTree } from "@oxlint/plugins";

type DestinationTaker = ESTree.CallExpression | ESTree.NewExpression;

const SEND_BEACON_NAME = "sendBeacon";

const NAVIGATOR_OBJECT_NAME = "navigator";

const isNavigatorSendBeacon = (callee: ESTree.Expression): boolean => {
  const member = staticMemberOf(callee);
  if (member === null || member.name !== SEND_BEACON_NAME) return false;
  const receiver = member.object;
  return receiver.type === "Identifier" && receiver.name === NAVIGATOR_OBJECT_NAME;
};

const CONNECTION_CONSTRUCTOR_NAMES: ReadonlySet<string> = new Set(["EventSource", "WebSocket"]);

const isConnectionConstructor = (callee: ESTree.Expression): boolean => {
  const written = callee;
  return written.type === "Identifier" && CONNECTION_CONSTRUCTOR_NAMES.has(written.name);
};

const FETCH_NAME = "fetch";

const isFetchCallee = (callee: ESTree.Expression): boolean => {
  const written = callee;
  if (written.type === "Identifier") return written.name === FETCH_NAME;
  return staticMemberOf(written)?.name === FETCH_NAME;
};

const REQUEST_CONSTRUCTOR_NAME = "Request";

const isRequestHandedToFetch = (node: ESTree.NewExpression): boolean => {
  const { callee, parent } = node;
  return (
    callee.type === "Identifier" &&
    callee.name === REQUEST_CONSTRUCTOR_NAME &&
    parent.type === "CallExpression" &&
    isFetchCallee(parent.callee) &&
    parent.arguments[0] === node
  );
};

const takesADestination = (node: DestinationTaker): boolean =>
  node.type === "NewExpression"
    ? isConnectionConstructor(node.callee) || isRequestHandedToFetch(node)
    : isFetchCallee(node.callee) || isNavigatorSendBeacon(node.callee);

const writtenOutDestinationOf = (node: DestinationTaker): ESTree.Expression | null => {
  if (!takesADestination(node)) return null;
  const [destination] = node.arguments;
  if (destination === undefined || destination.type === "SpreadElement") return null;
  return hasWrittenOutText(destination) ? destination : null;
};

export const noHardcodedEndpoint = createDontReviewItRule({
  name: "no-hardcoded-endpoint--read-from-configuration",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow text written out in the source at the destination argument of a call that opens a connection, so where a deployment talks to is decided by its configuration rather than by the file that performs the request",
      relatedGuidelines: ["apps/wiki/content/docs/guidelines/placement-and-tools.md"],
    },
    messages: {
      hardcodedEndpoint:
        "A call that opens a connection must not take its destination from text written out in this file. Read the destination from configuration and pass it in: take it from the environment the process was started with, or accept it as a parameter of the function that performs the request.",
    },
    schema: [],
  },
  create(inspection) {
    const reportWrittenOutDestination = (node: DestinationTaker) => {
      const destination = writtenOutDestinationOf(node);
      if (destination === null) return;
      inspection.report({ node: destination, messageId: "hardcodedEndpoint" });
    };

    return {
      CallExpression: reportWrittenOutDestination,
      NewExpression: reportWrittenOutDestination,
    };
  },
});
