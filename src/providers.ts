import { resolveProviders } from "./utils";

export const PROVIDER_SYMBOL = Symbol("@@Provider");

export interface Provider<T> {
  provide: (...args: any[]) => T;
}

export abstract class BaseProvider<T> implements Provider<T> {
  private [PROVIDER_SYMBOL] = true;

  abstract provide(...args: any[]): T;

  get provider(): Delegate<T> { // TODO: This needs to be a delegate that returns Provider<T>
    return new Delegate(this);
  }
}

export class Factory<T, ProvideArgs extends any[] = any[]> extends BaseProvider<T> {
  private injectedArgs: any[];

  constructor(
    private factory: new (...args: any[]) => T, // TODO factory should support factory methods and functions
    ...injectedArgs: any[]
  ) {
    super();
    this.injectedArgs = injectedArgs;
  }

  provide(...args: ProvideArgs): T {
    const resolvedArgs = this.injectedArgs.map((arg) => resolveProviders(arg));
    return new this.factory(...args, ...resolvedArgs);
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

export class Delegate<T> extends BaseProvider<Provider<T>> { // TODO: T should extend Provider<T>
  constructor(private readonly delegatedProvider: Provider<T>) {
    super();
  }

  provide(): Provider<T> {
    return this.delegatedProvider;
  }
}
