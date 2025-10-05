export {};
// --- types & decorator from before ---
type Constructor<T = object> = new (...args: any[]) => T;

interface Provider<T = unknown> { readonly kind: "Factory" | "Singleton" }
type ProviderKeys<T> = { [K in keyof T]-?: T[K] extends Provider<any> ? K : never }[keyof T];
type InstanceProviders<T> = Pick<T, ProviderKeys<T>>;
type WithStaticProviders<TCtor extends Constructor> = TCtor & InstanceProviders<InstanceType<TCtor>>;

function StaticMirrorProviders<TCtor extends Constructor>(ctor: TCtor): WithStaticProviders<TCtor> {
  const instance = new ctor();
  for (const key of Reflect.ownKeys(instance) as (keyof typeof instance)[]) {
    const val = (instance as any)[key];
    if (val && typeof val === "object" && (val.kind === "Factory" || val.kind === "Singleton")) {
      if (!(key in ctor)) {
        Object.defineProperty(ctor, key, { get: () => (instance as any)[key], configurable: true, enumerable: true });
      }
    }
  }
  return ctor as WithStaticProviders<TCtor>;
}

// --- your providers (stubs) ---
class Factory<T> implements Provider<T> { readonly kind = "Factory" as const; constructor(public target: new (...a:any)=>T, public args:any) {} create() { return new this.target(this.args); } }
class Singleton<T> implements Provider<T> { readonly kind = "Singleton" as const; private _i?:T; constructor(public target:new(...a:any)=>T, public deps?:any) {} get instance(){ return this._i ??= new this.target(this.deps);} }

// --- Provide helper for type-safe default parameters ---
function Provide<T>(provider: Provider<T>): T {
  return provider as any;
}

// --- minimal DI metadata: parameter @inject markers ---
const TOKEN_IDS = new WeakMap<object, symbol>();
const PARAM_INJECT_IDS = new WeakMap<Function, Map<number, symbol>>();

function getTokenId(token: object): symbol {
  let id = TOKEN_IDS.get(token);
  if (!id) {
    id = Symbol("di:token");
    TOKEN_IDS.set(token, id);
  }
  return id;
}

function resolveDecoratedFunction(target: any, propertyKey: string | symbol | undefined): Function | undefined {
  if (propertyKey != null && target) {
    return (target as any)[propertyKey];
  }
  if (typeof target === "function") {
    // constructor parameter decorator case
    return target as unknown as Function;
  }
  // Note: top-level function parameter decorators are not standard; this is a prototype.
  return undefined;
}

function inject(token: object) {
  const tokenId = getTokenId(token);
  return function (_target: any, _propertyKey: string | symbol | undefined, parameterIndex: number) {
    const fn = resolveDecoratedFunction(_target, _propertyKey);
    if (!fn) return;
    let map = PARAM_INJECT_IDS.get(fn);
    if (!map) {
      map = new Map<number, symbol>();
      PARAM_INJECT_IDS.set(fn, map);
    }
    map.set(parameterIndex, tokenId);
  };
}

function getInjectedParamIds(fn: Function): ReadonlyMap<number, symbol> | undefined {
  return PARAM_INJECT_IDS.get(fn);
}

function getMarkerFor(token: object): symbol {
  return getTokenId(token);
}

// Helper to attach injection metadata to standalone functions' parameters
function markFunctionParam(fn: Function, parameterIndex: number, token: object): void {
  const tokenId = getTokenId(token);
  let map = PARAM_INJECT_IDS.get(fn);
  if (!map) {
    map = new Map<number, symbol>();
    PARAM_INJECT_IDS.set(fn, map);
  }
  map.set(parameterIndex, tokenId);
}

// --- domain ---
class DatabaseConfig { constructor(public host:string, public port:number, public database:string) {} }
class CacheConfig { constructor(public ttl:number, public maxSize:number) {} }
class Database { constructor(public cfg: DatabaseConfig) {} query(sql:string){} }

// ---- container built via factory around a class expression ----
const Container = StaticMirrorProviders(class {
  databaseConfig = new Factory(DatabaseConfig, { host: "localhost", port: 5432, database: "myapp" });
  cacheConfig    = new Factory(CacheConfig,   { ttl: 3600, maxSize: 1000 });
  database       = new Singleton(Database, this.databaseConfig.create());
});

// ✅ typed statics:
Container.database.instance.query("select 1");
Container.databaseConfig.create().database;
Container.cacheConfig.create().maxSize;

// ✅ typed instances still work too:
const c = new Container();
c.database.instance.query("select 1");

const c2 = new Container();

console.log(Container.database === c.database);
console.log(Container.database.instance === c.database.instance);

console.log(Container.database.instance === Container.database.instance);
console.log(c.database.instance === c.database.instance);

console.log(Container.database.instance === c2.database.instance);
console.log(c.database.instance === c2.database.instance);

console.log(c2.database.instance === c2.database.instance);

class Program {
  main(
    args: any[],
    @inject(Container.database) database: Database = Provide(Container.database),
  ) {
    console.log(args, database);
    console.log(database);
  }
}

function introspectProvide(p: Program) {
  const paramMarkers = getInjectedParamIds(p.main);
  console.log("param markers", paramMarkers && Array.from(paramMarkers.entries()));
  console.log("database marker", getMarkerFor(Container.database));
}

const p = new Program();
p.main([1, 2, 3]);
introspectProvide(p);
