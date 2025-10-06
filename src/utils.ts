import { Provider, PROVIDER_SYMBOL } from "./providers";

/**
 * Type guard to check if a value is one of our Provider instances
 */
function isProvider(value: unknown): value is Provider<unknown> {
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
export function resolveProviders(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  resolved: WeakMap<object, unknown> = new WeakMap()
): unknown {
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
    const resolvedArray: unknown[] = [];
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
  // At this point, we know value is an object (passed all previous checks)
  const proto: unknown = Object.getPrototypeOf(value);
  const isPlainObject = proto === Object.prototype || proto === null;

  if (!isPlainObject) {
    // Don't traverse class instances - return as-is
    return value;
  }

  // Handle plain objects - traverse and resolve their properties
  const resolvedObj: Record<string, unknown> = {};
  resolved.set(value, resolvedObj);
  for (const key of Object.keys(value)) {
    // We know value is an object at this point, so we can safely index it
    resolvedObj[key] = resolveProviders((value as Record<string, unknown>)[key], seen, resolved);
  }
  seen.delete(value);
  return resolvedObj;
}
