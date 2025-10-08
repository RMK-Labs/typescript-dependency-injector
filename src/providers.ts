import { resolveProviders } from "./utils";

export const PROVIDER_SYMBOL = Symbol("@@Provider");

export interface Provider<T> {
  provide: (...args: any[]) => T;
}

export abstract class BaseProvider<T> implements Provider<T> {
  private [PROVIDER_SYMBOL] = true;

  abstract provide(...args: any[]): T;

  /**
   * Returns a Delegate provider that wraps this provider.
   * The Delegate's provide() method returns this provider instance.
   */
  get provider(): Delegate<T> {
    return new Delegate(this);
  }
}

/**
 * Type representing a constructable that can create instances of T.
 * Can be either a class constructor or a factory function.
 */
export type FactoryConstructable<T> = (new (...args: any[]) => T) | ((...args: any[]) => T);

export class Factory<T, ProvideArgs extends any[] = any[]> extends BaseProvider<T> {
  private injectedArgs: any[];
  private isConstructor: boolean;

  constructor(
    private factory: FactoryConstructable<T>,
    ...injectedArgs: any[]
  ) {
    super();
    this.injectedArgs = injectedArgs;

    // Detect if the factory is a constructor or a function
    this.isConstructor = typeof factory === "function" &&
      factory.prototype !== undefined &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      factory.prototype.constructor === factory;
  }

  provide(...args: ProvideArgs): T {
    const resolvedArgs = this.injectedArgs.map((arg) => resolveProviders(arg));

    if (this.isConstructor) {
      return new (this.factory as new (...args: any[]) => T)(...args, ...resolvedArgs);
    } else {
      return (this.factory as (...args: any[]) => T)(...args, ...resolvedArgs);
    }
  }
}

export class Singleton<T, ProvideArgs extends any[] = any[]> extends Factory<T, ProvideArgs> {
  private instance: T | null = null;

  provide(...args: ProvideArgs): T {
    if (this.instance === null) {
      this.instance = super.provide(...args);
    }
    return this.instance;
  }
}

/**
 * Delegate provider that wraps another provider.
 * When provide() is called, it returns the wrapped provider instance itself.
 * This is useful for dependency injection scenarios where you want to inject
 * the provider rather than the provided value.
 */
export class Delegate<T> extends BaseProvider<Provider<T>> {
  constructor(private readonly delegatedProvider: Provider<T>) {
    super();
  }

  provide(): Provider<T> {
    return this.delegatedProvider;
  }
}
