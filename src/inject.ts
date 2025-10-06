import { DeclarativeContainer } from "./container";
import { BaseProvider, PROVIDER_SYMBOL } from "./providers";

type Constructor<T = object> = new (...args: any[]) => T;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type AnyFunction = Function;

// Type utilities to extract provider-like keys from a container instance
type IsProviderLike<T> = T extends BaseProvider<any>
  ? true
  : T extends { provide: (...args: any[]) => any }
  ? true
  : false;

type ProviderKeys<T> = {
  [K in keyof T]-?: IsProviderLike<T[K]> extends true ? K : never;
}[keyof T];

export type InjectableMarkers<TContainer extends DeclarativeContainer> = {
  [K in ProviderKeys<TContainer>]: ParameterDecorator;
};

// Internal registry for provider tokens per container class
const CONTAINER_PROVIDER_TOKENS = new WeakMap<AnyFunction, Map<PropertyKey, symbol>>();

// Internal registry for function parameter injection markers
const PARAM_INJECT_IDS = new WeakMap<AnyFunction, Map<number, symbol>>();

function getTokenFor(containerCtor: AnyFunction, key: PropertyKey): symbol {
  let byKey = CONTAINER_PROVIDER_TOKENS.get(containerCtor);
  if (!byKey) {
    byKey = new Map<PropertyKey, symbol>();
    CONTAINER_PROVIDER_TOKENS.set(containerCtor, byKey);
  }
  let token = byKey.get(key);
  if (!token) {
    token = Symbol(`di:token:${String(key)}`);
    byKey.set(key, token);
  }
  return token;
}

function resolveDecoratedFunction(target: any, propertyKey: string | symbol | undefined): AnyFunction | undefined {
  if (propertyKey != null && target) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return
    return target[propertyKey];
  }
  if (typeof target === "function") {
    return target as unknown as AnyFunction;
  }
  return undefined;
}

function isProviderLike(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    PROVIDER_SYMBOL in value &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (value as any)[PROVIDER_SYMBOL] === true
  );
}

export function createInject<TCtor extends Constructor<DeclarativeContainer>>(
  options: { containerClass: TCtor }
): InjectableMarkers<InstanceType<TCtor>> {
  const { containerClass } = options;
  const instance = new containerClass();

  const markers: Record<PropertyKey, ParameterDecorator> = {};

  for (const key of Reflect.ownKeys(instance) as (keyof typeof instance)[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const val = (instance as any)[key];
    if (!isProviderLike(val)) continue;

    const token = getTokenFor(containerClass, key);

    const decorator: ParameterDecorator = (_target, _propertyKey, parameterIndex) => {
      const fn = resolveDecoratedFunction(_target, _propertyKey);
      if (!fn) return;
      let paramMap = PARAM_INJECT_IDS.get(fn);
      if (!paramMap) {
        paramMap = new Map<number, symbol>();
        PARAM_INJECT_IDS.set(fn, paramMap);
      }
      paramMap.set(parameterIndex, token);
    };

    Object.defineProperty(markers, key, {
      value: decorator,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }

  return markers as unknown as InjectableMarkers<InstanceType<TCtor>>;
}

// Introspection helpers to be used later by the injector implementation
export function getInjectedParamIds(fn: AnyFunction): ReadonlyMap<number, symbol> | undefined {
  return PARAM_INJECT_IDS.get(fn);
}

export function getMarkerFor<TCtor extends Constructor<DeclarativeContainer>>(
  containerCtor: TCtor,
  key: ProviderKeys<InstanceType<TCtor>> & PropertyKey
): symbol {
  return getTokenFor(containerCtor, key);
}

// TypeScript-only helper to satisfy types when calling functions that rely on
// parameter decorators for injection. It returns undefined at runtime.
export function Provide<T extends abstract new (...args: any[]) => any>(
  _type: T
): InstanceType<T>;
export function Provide<T>(_type: T): T;
export function Provide(_type: any): any {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return undefined as any;
}
