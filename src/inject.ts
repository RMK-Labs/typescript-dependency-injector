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
  [K in ProviderKeys<TContainer>]: ParameterDecorator & {
    provider: ParameterDecorator;
  };
};

export type InjectAPI<TContainer extends DeclarativeContainer> = InjectableMarkers<TContainer> & {
  wire: (container: TContainer) => void;
  unwire: (container: TContainer) => void;
  Injectable: <T extends Constructor>(target: T) => T;
};

// Internal registry for provider tokens per container class
const CONTAINER_PROVIDER_TOKENS = new WeakMap<AnyFunction, Map<PropertyKey, symbol>>();

// Internal registry for provider-as-value tokens (for .provider syntax)
const CONTAINER_PROVIDER_AS_VALUE_TOKENS = new WeakMap<AnyFunction, Map<PropertyKey, symbol>>();

// Internal registry for function parameter injection markers
const PARAM_INJECT_IDS = new WeakMap<AnyFunction, Map<number, symbol>>();

// Track decoration sites: target -> propertyKey -> paramIndex -> token
type DecorationSite = {
  target: any;
  propertyKey: PropertyKey;
  paramIndex: number;
  token: symbol;
};

// Track constructor injection sites separately
type ConstructorDecorationSite = {
  constructor: Constructor;
  paramIndex: number;
  token: symbol;
};

// Internal registry for decoration sites per container class
const DECORATION_SITES = new WeakMap<AnyFunction, DecorationSite[]>();

// Internal registry for constructor decoration sites per container class
const CONSTRUCTOR_DECORATION_SITES = new WeakMap<AnyFunction, ConstructorDecorationSite[]>();

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

function getProviderTokenFor(containerCtor: AnyFunction, key: PropertyKey): symbol {
  let byKey = CONTAINER_PROVIDER_AS_VALUE_TOKENS.get(containerCtor);
  if (!byKey) {
    byKey = new Map<PropertyKey, symbol>();
    CONTAINER_PROVIDER_AS_VALUE_TOKENS.set(containerCtor, byKey);
  }
  let token = byKey.get(key);
  if (!token) {
    token = Symbol(`di:provider-token:${String(key)}`);
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
): InjectAPI<InstanceType<TCtor>> {
  const { containerClass } = options;
  const instance = new containerClass();

  const markers: Record<PropertyKey, ParameterDecorator> = {};

  // Track which containers are currently wired
  const wiredContainers = new Set<InstanceType<TCtor>>();

  // Track which methods have been wrapped (target -> Set<propertyKey>)
  const wrappedMethods = new WeakMap<any, Set<PropertyKey>>();

  for (const key of Reflect.ownKeys(instance) as (keyof typeof instance)[]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const val = (instance as any)[key];
    if (!isProviderLike(val)) continue;

    const token = getTokenFor(containerClass, key);
    const providerToken = getProviderTokenFor(containerClass, key);

    const decorator: ParameterDecorator = (_target, _propertyKey, parameterIndex) => {
      // Handle constructor parameters
      if (_propertyKey === undefined) {
        if (typeof _target === "function") {
          // _target is the constructor function itself
          let constructorSites = CONSTRUCTOR_DECORATION_SITES.get(containerClass);
          if (!constructorSites) {
            constructorSites = [];
            CONSTRUCTOR_DECORATION_SITES.set(containerClass, constructorSites);
          }
          constructorSites.push({
            constructor: _target as Constructor,
            paramIndex: parameterIndex,
            token: token,
          });
        }
        return;
      }

      const fn = resolveDecoratedFunction(_target, _propertyKey);
      if (!fn) return;

      let paramMap = PARAM_INJECT_IDS.get(fn);
      if (!paramMap) {
        paramMap = new Map<number, symbol>();
        PARAM_INJECT_IDS.set(fn, paramMap);
      }
      paramMap.set(parameterIndex, token);

      // Record decoration site for this container class
      let sites = DECORATION_SITES.get(containerClass);
      if (!sites) {
        sites = [];
        DECORATION_SITES.set(containerClass, sites);
      }
      sites.push({
        target: _target,
        propertyKey: _propertyKey,
        paramIndex: parameterIndex,
        token: token,
      });
    };

    // Create decorator for injecting the provider itself
    const providerDecorator: ParameterDecorator = (_target, _propertyKey, parameterIndex) => {
      // Handle constructor parameters
      if (_propertyKey === undefined) {
        if (typeof _target === "function") {
          // _target is the constructor function itself
          let constructorSites = CONSTRUCTOR_DECORATION_SITES.get(containerClass);
          if (!constructorSites) {
            constructorSites = [];
            CONSTRUCTOR_DECORATION_SITES.set(containerClass, constructorSites);
          }
          constructorSites.push({
            constructor: _target as Constructor,
            paramIndex: parameterIndex,
            token: providerToken,
          });
        }
        return;
      }

      const fn = resolveDecoratedFunction(_target, _propertyKey);
      if (!fn) return;

      let paramMap = PARAM_INJECT_IDS.get(fn);
      if (!paramMap) {
        paramMap = new Map<number, symbol>();
        PARAM_INJECT_IDS.set(fn, paramMap);
      }
      paramMap.set(parameterIndex, providerToken);

      // Record decoration site for this container class
      let sites = DECORATION_SITES.get(containerClass);
      if (!sites) {
        sites = [];
        DECORATION_SITES.set(containerClass, sites);
      }
      sites.push({
        target: _target,
        propertyKey: _propertyKey,
        paramIndex: parameterIndex,
        token: providerToken,
      });
    };

    // Attach the provider decorator as a property
    Object.defineProperty(decorator, 'provider', {
      value: providerDecorator,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    Object.defineProperty(markers, key, {
      value: decorator,
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }

  function findProviderByToken(container: InstanceType<TCtor>, token: symbol): BaseProvider<any> | undefined {
    // Iterate through container properties to find the provider with matching token
    for (const key of Reflect.ownKeys(container) as (keyof typeof container)[]) {
      const containerToken = getTokenFor(containerClass, key);
      const providerContainerToken = getProviderTokenFor(containerClass, key);

      if (containerToken === token) {
        // Regular injection - return the provider
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const provider = (container as any)[key];
        if (isProviderLike(provider)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return provider;
        }
      } else if (providerContainerToken === token) {
        // Provider injection - return the Delegate of the provider
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const provider = (container as any)[key];
        if (isProviderLike(provider)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
          return (provider as any).provider;
        }
      }
    }
    return undefined;
  }

  function wire(container: InstanceType<TCtor>): void {
    wiredContainers.add(container);

    // Get decoration sites for this container class
    const sites = DECORATION_SITES.get(containerClass);
    if (!sites) return;

    // Group sites by target and propertyKey
    const sitesByTargetAndKey = new Map<any, Map<PropertyKey, DecorationSite[]>>();
    for (const site of sites) {
      let byKey = sitesByTargetAndKey.get(site.target);
      if (!byKey) {
        byKey = new Map();
        sitesByTargetAndKey.set(site.target, byKey);
      }
      let sitesForKey = byKey.get(site.propertyKey);
      if (!sitesForKey) {
        sitesForKey = [];
        byKey.set(site.propertyKey, sitesForKey);
      }
      sitesForKey.push(site);
    }

    // Wrap methods that haven't been wrapped yet
    for (const [target, byKey] of sitesByTargetAndKey.entries()) {
      let wrapped = wrappedMethods.get(target);
      if (!wrapped) {
        wrapped = new Set();
        wrappedMethods.set(target, wrapped);
      }

      for (const [propertyKey, sitesForKey] of byKey.entries()) {
        if (wrapped.has(propertyKey)) continue; // Already wrapped

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const originalFn = target[propertyKey];
        if (typeof originalFn !== 'function') continue;

        // Create wrapper that checks for wired containers at call time
        const wrapper = function(this: any, ...args: any[]): any {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const newArgs = [...args];

          // Use the first wired container (FIFO order)
          const activeContainer = wiredContainers.values().next().value;

          if (activeContainer) {
            // Build map of param indices to tokens for this method
            const tokensByIndex = new Map<number, symbol>();
            for (const site of sitesForKey) {
              tokensByIndex.set(site.paramIndex, site.token);
            }

            // Inject dependencies for parameters that are undefined or missing
            for (const [paramIndex, token] of tokensByIndex.entries()) {
              if (paramIndex >= newArgs.length || newArgs[paramIndex] === undefined) {
                const provider = findProviderByToken(activeContainer, token);
                if (provider) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                  newArgs[paramIndex] = provider.provide();
                }
              }
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          return originalFn.apply(this, newArgs);
        };

        // Replace the method on the target (prototype or instance)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        target[propertyKey] = wrapper;
        wrapped.add(propertyKey);
      }
    }
  }

  function unwire(container: InstanceType<TCtor>): void {
    wiredContainers.delete(container);
  }

  // Class decorator for constructor injection
  function Injectable<T extends Constructor>(target: T): T {
    // Get constructor decoration sites for this container class
    const constructorSites = CONSTRUCTOR_DECORATION_SITES.get(containerClass);
    if (!constructorSites) {
      return target; // No injection needed
    }

    // Find sites for this specific constructor
    const sitesForConstructor = constructorSites.filter(site => site.constructor === target);
    if (sitesForConstructor.length === 0) {
      return target; // No injection needed for this constructor
    }

    // Create a map of parameter indices to tokens
    const tokensByIndex = new Map<number, symbol>();
    for (const site of sitesForConstructor) {
      tokensByIndex.set(site.paramIndex, site.token);
    }

    // Create a Proxy that wraps the constructor
    const proxy = new Proxy(target, {
      construct(Target, args: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const newArgs = [...args];

        // Use the first wired container (FIFO order)
        const activeContainer = wiredContainers.values().next().value;

        if (activeContainer) {
          // Inject dependencies for parameters that are undefined or missing
          for (const [paramIndex, token] of tokensByIndex.entries()) {
            if (paramIndex >= newArgs.length || newArgs[paramIndex] === undefined) {
              const provider = findProviderByToken(activeContainer, token);
              if (provider) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                newArgs[paramIndex] = provider.provide();
              }
            }
          }
        }

        return new Target(...newArgs);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return proxy as any;
  }

  return { ...markers, wire, unwire, Injectable } as unknown as InjectAPI<InstanceType<TCtor>>;
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
export function Provide<T>(): T;
export function Provide(_type?: any): any {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return undefined as any;
}
