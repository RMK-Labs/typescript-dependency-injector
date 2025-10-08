import { resolveProviders } from "./utils";

export const PROVIDER_SYMBOL = Symbol("@@Provider");

export interface Provider<T> {
  provide: (...args: any[]) => T;
}

export abstract class BaseProvider<T> implements Provider<T> {
  private [PROVIDER_SYMBOL] = true;
  private _overridingProviders: Provider<T>[] = [];

  abstract provide(...args: any[]): T;

  /**
   * Returns a readonly copy of the overriding providers stack.
   */
  get overrides(): readonly Provider<T>[] {
    return [...this._overridingProviders];
  }

  /**
   * Overrides the current provider with another provider.
   * When the provider is called, it will delegate to the last overriding provider.
   * @param provider - The provider to override with
   * @throws Error if the argument is not a provider
   */
  override(provider: Provider<T>): void {
    if (!provider || typeof provider.provide !== "function") {
      throw new Error("Override argument must be a provider with a provide() method");
    }
    this._overridingProviders.push(provider);
  }

  /**
   * Resets the last overriding provider and returns it.
   * @returns The provider that was removed from the override stack
   * @throws Error if there are no overriding providers
   */
  resetLastOverriding(): Provider<T> {
    if (this._overridingProviders.length === 0) {
      throw new Error("No overriding providers to reset");
    }
    return this._overridingProviders.pop()!;
  }

  /**
   * Resets all overriding providers at once and returns them.
   * @returns An array of all providers that were removed from the override stack
   */
  resetOverride(): Provider<T>[] {
    const removed = [...this._overridingProviders];
    this._overridingProviders = [];
    return removed;
  }

  /**
   * Returns true if the provider is currently overridden, false otherwise.
   */
  isOverridden(): boolean {
    return this._overridingProviders.length > 0;
  }

  /**
   * Returns a Delegate provider that wraps this provider.
   * The Delegate's provide() method returns this provider instance.
   */
  get provider(): Delegate<T> {
    return new Delegate(this);
  }

  /**
   * Protected method for providers to delegate to the overriding provider if one exists.
   * Should be called at the beginning of each provider's provide() method.
   */
  protected _delegateIfOverridden(...args: any[]): T | undefined {
    if (this._overridingProviders.length > 0) {
      const overridingProvider = this._overridingProviders[this._overridingProviders.length - 1];
      return overridingProvider.provide(...args);
    }
    return undefined;
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
    const overridden = this._delegateIfOverridden(...args);
    if (overridden !== undefined) {
      return overridden;
    }

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
    const overridden = this._delegateIfOverridden(...args);
    if (overridden !== undefined) {
      return overridden;
    }

    if (this.instance === null) {
      this.instance = super.provide(...args);
    }
    return this.instance;
  }

  resetInstance(): void {
    this.instance = null;
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
    const overridden = this._delegateIfOverridden();
    if (overridden !== undefined) {
      return overridden;
    }

    return this.delegatedProvider;
  }
}
