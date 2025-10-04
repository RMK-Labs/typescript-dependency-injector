const PROVIDER_SYMBOL = Symbol("@@Provider");

export interface Provider<T> {
  provide: (...args: any[]) => T;
}

export class Factory<T> implements Provider<T> {
  private injectedArgs: any[];
  private [PROVIDER_SYMBOL] = true;

  constructor(
    private factory: new (...args: any[]) => T,
    ...injectedArgs: any[]
  ) {
    this.injectedArgs = injectedArgs;
  }

  provide(...args: any[]): T {
    const resolvedArgs = this.injectedArgs.map((arg) => resolveProviders(arg));
    return new this.factory(...args, ...resolvedArgs);
  }
}

export class Singleton<T> extends Factory<T> {
  private instance: T | null = null;

  provide(...args: any[]): T {
    if (this.instance === null) {
      this.instance = super.provide(...args);
    }
    return this.instance;
  }
}

/**
 * Type guard to check if a value is one of our Provider instances
 */
function isProvider(value: any): value is Provider<any> {
  return (
    value !== null &&
    typeof value === "object" &&
    PROVIDER_SYMBOL in value &&
    value[PROVIDER_SYMBOL] === true
  );
}

/**
 * Recursively resolves Provider instances within a value structure.
 * Handles objects, arrays, and nested structures safely with circular reference detection.
 *
 * @param value - The value to inspect and resolve
 * @param seen - WeakSet to track already-visited objects for circular reference detection
 * @param resolved - WeakMap to cache resolved objects and maintain object identity
 * @returns The value with all Provider instances resolved via their provide() method
 */
function resolveProviders(
  value: any,
  seen: WeakSet<object> = new WeakSet(),
  resolved: WeakMap<object, any> = new WeakMap()
): any {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives (string, number, boolean, bigint, symbol)
  if (typeof value !== "object" && typeof value !== "function") {
    return value;
  }

  // Handle functions (don't traverse)
  if (typeof value === "function") {
    return value;
  }

  // Check for Provider instances first (before circular check)
  // This allows Providers to be resolved even if seen before
  if (isProvider(value)) {
    return value.provide();
  }

  // Check if we've already resolved this object (circular reference)
  if (resolved.has(value)) {
    return resolved.get(value);
  }

  // Circular reference detection for in-progress resolution
  if (seen.has(value)) {
    return value; // Return as-is to avoid infinite recursion
  }

  // Add to seen set
  seen.add(value);

  // Handle Date objects (don't traverse)
  if (value instanceof Date) {
    return value;
  }

  // Handle RegExp objects (don't traverse)
  if (value instanceof RegExp) {
    return value;
  }

  // Handle Arrays
  if (Array.isArray(value)) {
    const resolvedArray: any[] = [];
    resolved.set(value, resolvedArray);
    for (const item of value) {
      resolvedArray.push(resolveProviders(item, seen, resolved));
    }
    seen.delete(value);
    return resolvedArray;
  }

  // Handle Map
  if (value instanceof Map) {
    const resolvedMap = new Map();
    resolved.set(value, resolvedMap);
    for (const [key, val] of value.entries()) {
      resolvedMap.set(key, resolveProviders(val, seen, resolved));
    }
    seen.delete(value);
    return resolvedMap;
  }

  // Handle Set
  if (value instanceof Set) {
    const resolvedSet = new Set();
    resolved.set(value, resolvedSet);
    for (const item of value.values()) {
      resolvedSet.add(resolveProviders(item, seen, resolved));
    }
    seen.delete(value);
    return resolvedSet;
  }

  // Only traverse plain objects (not class instances)
  // Class instances should be passed through as-is
  const proto = Object.getPrototypeOf(value);
  const isPlainObject = proto === Object.prototype || proto === null;

  if (!isPlainObject) {
    // Don't traverse class instances - return as-is
    return value;
  }

  // Handle plain objects - traverse and resolve their properties
  const resolvedObj: any = {};
  resolved.set(value, resolvedObj);
  for (const key of Object.keys(value)) {
    resolvedObj[key] = resolveProviders(value[key], seen, resolved);
  }
  seen.delete(value);
  return resolvedObj;
}
