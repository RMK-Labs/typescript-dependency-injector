import { BaseProvider, PROVIDER_SYMBOL, Singleton } from "./providers";

type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Helper type to check if a type looks like a provider
 * Matches BaseProvider or objects with a provide method
 */
type IsProviderLike<T> = T extends BaseProvider<any>
  ? true
  : T extends { provide: (...args: any[]) => any }
  ? true
  : false;

/**
 * Extract keys from T where the value is a Provider (extends BaseProvider or looks like a provider)
 */
type ProviderKeys<T> = {
  [K in keyof T]-?: IsProviderLike<T[K]> extends true ? K : never;
}[keyof T];

/**
 * Pick only the provider properties from T
 */
type InstanceProviders<T> = Pick<T, ProviderKeys<T>>;

/**
 * A constructor with provider properties mirrored as static members
 */
type WithStaticProviders<TCtor extends Constructor> = TCtor &
  InstanceProviders<InstanceType<TCtor>>;

/**
 * Base class for declarative dependency injection containers.
 * Extend this class and define provider properties to create a container.
 *
 * @example
 * ```ts
 * const Container = initDeclarativeContainer(class extends DeclarativeContainer {
 *   database = new Singleton(Database, this.config.provider);
 *   config = new Factory(Config);
 * });
 *
 * // Access providers as static properties
 * const db = Container.database.provide();
 * ```
 */
export abstract class DeclarativeContainer {

  resetProviderOverrides(): void {
    for (const key of Reflect.ownKeys(this) as (keyof typeof this)[]) {
      const val = (this as any)[key];
      if (val instanceof BaseProvider) {
        val.resetOverride();
      }
    }
  }

  resetSingletonInstances(): void {
    for (const key of Reflect.ownKeys(this) as (keyof typeof this)[]) {
      const val = (this as any)[key];
      if (val instanceof Singleton) {
        val.resetInstance();
      }
    }
  }

}

/**
 * Initialize a declarative container by mirroring instance provider properties
 * to static properties on the constructor.
 *
 * This allows providers to be accessed both as instance properties and as
 * static properties on the container class itself.
 *
 * @param ctor - A class extending DeclarativeContainer with provider properties
 * @returns The constructor with provider properties mirrored as static members
 *
 * @example
 * ```ts
 * const Container = initDeclarativeContainer(class extends DeclarativeContainer {
 *   databaseConfig = new Factory(DatabaseConfig, { host: "localhost", port: 5432 });
 *   database = new Singleton(Database, this.databaseConfig.provider);
 * });
 *
 * // Use static access
 * Container.database.provide();
 *
 * // Or instance access
 * const container = new Container();
 * container.database.provide();
 * ```
 */
export function initDeclarativeContainer<TCtor extends Constructor<DeclarativeContainer>>(
  ctor: TCtor
): WithStaticProviders<TCtor> {
  const instance = new ctor();

  // Mirror all provider properties from the instance to the constructor as static properties
  for (const key of Reflect.ownKeys(instance) as (keyof typeof instance)[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const val = (instance as any)[key];

    // Check if the value is a provider by looking for the PROVIDER_SYMBOL
    // This is a robust check that works with any class extending BaseProvider
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const isProviderLike = val &&
      typeof val === "object" &&
      PROVIDER_SYMBOL in val &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      val[PROVIDER_SYMBOL] === true;

    if (isProviderLike) {
      // Only add if not already present (avoid overwriting existing static members)
      if (!(key in ctor)) {
        Object.defineProperty(ctor, key, {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
          get: () => (instance as any)[key],
          configurable: true,
          enumerable: true,
        });
      }
    }
  }

  return ctor as WithStaticProviders<TCtor>;
}
