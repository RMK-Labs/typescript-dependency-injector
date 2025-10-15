/**
 * Symbol to identify Extend instances
 */
export const EXTEND_SYMBOL = Symbol("extend");

/**
 * Wraps an object to indicate that it should be extended with context values
 * when the provider's .provide() method is called.
 *
 * When a Factory is created with an Extend-wrapped object as an argument,
 * calling .provide(contextObj) will merge contextObj with the wrapped defaults,
 * with context values taking priority.
 *
 * @example
 * ```ts
 * interface ServiceDeps {
 *   logger: Logger;
 *   database: Database;
 *   requestId: string;
 * }
 *
 * class AppContainer extends DeclarativeContainer {
 *   logger = new Singleton(Logger);
 *   database = new Singleton(Database, "localhost");
 *
 *   // requestId will come from context at runtime
 *   service = new Factory(Service, Extend({
 *     logger: this.logger,
 *     database: this.database,
 *   }));
 * }
 *
 * const container = new AppContainer();
 * // Context values take priority and extend the defaults
 * const instance = container.service.provide({ requestId: "req-123" });
 * ```
 */
export class Extend<T extends Record<string, any>> {
  readonly [EXTEND_SYMBOL] = true;

  constructor(public readonly defaults: T) {}
}

/**
 * Type guard to check if a value is an Extend instance
 */
export function isExtend(value: unknown): value is Extend<any> {
  return (
    !!value &&
    typeof value === "object" &&
    EXTEND_SYMBOL in value &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (value as any)[EXTEND_SYMBOL] === true
  );
}
