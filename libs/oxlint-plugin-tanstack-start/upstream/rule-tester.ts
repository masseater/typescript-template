import { Array, Option, Predicate, pipe } from "effect";
import type { Rule } from "vite-plus/lint/plugins";
import { RuleTester as OxlintRuleTester } from "vite-plus/lint/plugins-dev";

type TestCase = OxlintRuleTester.ValidTestCase;

type TestCases = OxlintRuleTester.TestCases;

type Hook = (fn: () => void) => void;

interface UpstreamConfig {
  readonly languageOptions: Readonly<{
    parserOptions: Readonly<{ tsconfigRootDir: string }>;
  }>;
}

const DEFAULT_FILENAME = "react.tsx";

const located =
  (rootDirectory: string) =>
  <Case extends TestCase>(testCase: Case): Case => ({
    ...testCase,
    filename: `${rootDirectory}/${Option.getOrElse(Option.fromNullishOr(testCase.filename), () => DEFAULT_FILENAME)}`,
  });

const isTestCase = (testCase: TestCase | string): testCase is TestCase =>
  !Predicate.isString(testCase);

const asTestCase = (testCase: TestCase | string): TestCase =>
  Option.match(Option.liftPredicate(testCase, Predicate.isString), {
    onNone: () => Option.getOrThrow(Option.liftPredicate(testCase, isTestCase)),
    onSome: (code) => ({ code }),
  });

const ignoredHook: Hook = () => {
  Option.none();
};

class RuleTester {
  public static get describe(): OxlintRuleTester.DescribeFn {
    return OxlintRuleTester.describe;
  }

  public static set describe(value: OxlintRuleTester.DescribeFn) {
    OxlintRuleTester.describe = value;
  }

  public static get it(): OxlintRuleTester.ItFn {
    return OxlintRuleTester.it;
  }

  public static set it(value: OxlintRuleTester.ItFn) {
    OxlintRuleTester.it = value;
  }

  public static get itOnly(): OxlintRuleTester.ItFn {
    return OxlintRuleTester.itOnly;
  }

  public static set itOnly(value: OxlintRuleTester.ItFn) {
    OxlintRuleTester.itOnly = value;
  }

  public static get afterAll(): Hook {
    return ignoredHook;
  }

  public static set afterAll(_value: Hook) {
    Option.none();
  }

  readonly #rootDirectory: string;

  readonly #tester = new OxlintRuleTester({
    languageOptions: { parserOptions: { lang: "tsx" } },
  });

  public constructor(config: UpstreamConfig) {
    this.#rootDirectory = config.languageOptions.parserOptions.tsconfigRootDir;
  }

  public run(name: string, rule: Rule, tests: TestCases): void {
    const locate = located(this.#rootDirectory);
    this.#tester.run(name, rule, {
      valid: pipe(tests.valid, Array.map(asTestCase), Array.map(locate)),
      invalid: pipe(tests.invalid, Array.map(locate)),
    });
  }
}

export type { Hook, TestCases, UpstreamConfig };
export { RuleTester };
