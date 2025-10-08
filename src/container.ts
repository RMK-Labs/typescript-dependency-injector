import { BaseProvider, Singleton } from "./providers";

/**
 * Base class for declarative dependency injection containers.
 * Extend this class and define provider properties to create a container.
 *
 * @example
 * ```ts
 * class MyContainer extends DeclarativeContainer {
 *   databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
 *   database = new Singleton(Database, this.databaseConfig);
 * }
 *
 * const container = new MyContainer();
 *
 * // Access providers via instance properties
 * const db = container.database.provide();
 * const config = container.databaseConfig.provide();
 * ```
 */
export abstract class DeclarativeContainer {

  resetProviderOverrides(): void {
    for (const key of Reflect.ownKeys(this) as (keyof typeof this)[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const val = (this as any)[key];
      if (val instanceof BaseProvider) {
        val.resetOverride();
      }
    }
  }

  resetSingletonInstances(): void {
    for (const key of Reflect.ownKeys(this) as (keyof typeof this)[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const val = (this as any)[key];
      if (val instanceof Singleton) {
        val.resetInstance();
      }
    }
  }

}
