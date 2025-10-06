import { BaseProvider } from "./providers";

type Constructor<T = object> = new (...args: any[]) => T;

/**
 * Helper type to check if a type looks like a provider
 * Matches BaseProvider, or objects with provide method, or objects with kind property
 */
type IsProviderLike<T> = T extends BaseProvider<any>
  ? true
  : T extends { provide: (...args: any[]) => any }
  ? true
  : T extends { kind: "Factory" | "Singleton" }
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
export abstract class DeclarativeContainer {}

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
    const val = (instance as any)[key];

    // Check if the value is a BaseProvider instance or any object property
    // We check for BaseProvider specifically, but also allow any object that looks like a provider
    const isProviderLike = val && typeof val === "object" && (
      val instanceof BaseProvider ||
      // Allow duck-typing: any object with a provide method or common provider patterns
      typeof val.provide === "function" ||
      // Check for common provider properties (kind, instance, create methods)
      (val.kind && (val.kind === "Factory" || val.kind === "Singleton"))
    );

    if (isProviderLike) {
      // Only add if not already present (avoid overwriting existing static members)
      if (!(key in ctor)) {
        Object.defineProperty(ctor, key, {
          get: () => (instance as any)[key],
          configurable: true,
          enumerable: true,
        });
      }
    }
  }

  return ctor as WithStaticProviders<TCtor>;
}
