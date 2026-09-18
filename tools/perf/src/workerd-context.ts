import type { Context, ContextManager } from "@opentelemetry/api";
// oxlint-disable-next-line import/no-nodejs-modules
import { AsyncLocalStorage } from "node:async_hooks";
import { ROOT_CONTEXT } from "@opentelemetry/api";

function isCallable(value: unknown): value is (...args: readonly unknown[]) => unknown {
  return typeof value === "function";
}

class WorkerdContextManager implements ContextManager {
  readonly #storage = new AsyncLocalStorage<Context>();

  public active(): Context {
    return this.#storage.getStore() ?? ROOT_CONTEXT;
  }

  public with<
    Arguments extends unknown[],
    Callback extends (...args: Arguments) => ReturnType<Callback>,
  >(
    context: Context,
    callback: Callback,
    thisArgument?: ThisParameterType<Callback>,
    ...args: Arguments
  ): ReturnType<Callback> {
    return this.#storage.run(context, () => callback.apply(thisArgument, args));
  }

  public bind<Target>(context: Context, target: Target): Target {
    return isCallable(target)
      ? this.#storage.run(context, () => AsyncLocalStorage.bind(target))
      : target;
  }

  public enable(): this {
    return this;
  }

  public disable(): this {
    this.#storage.disable();
    return this;
  }
}

export { WorkerdContextManager };
