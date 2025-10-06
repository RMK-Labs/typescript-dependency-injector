import { Delegate, Factory, Singleton } from "../../src/providers";

describe("Delegate Provider", () => {
  describe("Basic Delegate behavior", () => {
    it("should create a Delegate provider that wraps another provider", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      const loggerFactory = new Factory(Logger);
      const loggerDelegate = new Delegate(loggerFactory);

      const returnedProvider = loggerDelegate.provide();

      expect(returnedProvider).toBe(loggerFactory);
    });

    it("should return the wrapped Factory provider", () => {
      class Counter {
        private count = 0;
        increment(): number {
          return ++this.count;
        }
      }

      const counterFactory = new Factory(Counter);
      const counterDelegate = new Delegate(counterFactory);

      const returnedProvider = counterDelegate.provide();

      expect(returnedProvider).toBe(counterFactory);
      expect(returnedProvider).toBeInstanceOf(Factory);
    });

    it("should return the wrapped Singleton provider", () => {
      class Counter {
        private count = 0;
        increment(): number {
          return ++this.count;
        }
      }

      const counterSingleton = new Singleton(Counter);
      const counterDelegate = new Delegate(counterSingleton);

      const returnedProvider = counterDelegate.provide();

      expect(returnedProvider).toBe(counterSingleton);
      expect(returnedProvider).toBeInstanceOf(Singleton);
    });

    it("should work with nested Delegate providers", () => {
      class Service {
        getValue(): string {
          return "service-value";
        }
      }

      const serviceFactory = new Factory(Service);
      const delegate1 = new Delegate(serviceFactory);
      const delegate2 = new Delegate(delegate1);
      const delegate3 = new Delegate(delegate2);

      const returnedProvider = delegate3.provide();

      expect(returnedProvider).toBe(delegate2);

      const unwrappedOnce = returnedProvider.provide();
      expect(unwrappedOnce).toBe(delegate1);

      const unwrappedTwice = unwrappedOnce.provide();
      expect(unwrappedTwice).toBe(serviceFactory);
    });

    it("should return the wrapped provider regardless of arguments", () => {
      class ConfigurableService {
        constructor(
          public name: string,
          public port: number
        ) {}
      }

      const serviceFactory = new Factory(ConfigurableService);
      const serviceDelegate = new Delegate(serviceFactory);

      const returnedProvider = serviceDelegate.provide();

      expect(returnedProvider).toBe(serviceFactory);
      expect(returnedProvider).toBeInstanceOf(Factory);
    });
  });

  describe("Delegate in dependency injection", () => {
    it("should be resolved to the wrapped provider when used as injected argument", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      class Service {
        constructor(public loggerProvider: Factory<Logger>) {}
      }

      const loggerFactory = new Factory(Logger);
      const loggerDelegate = new Delegate(loggerFactory);
      const serviceFactory = new Factory(Service, loggerDelegate);

      const service = serviceFactory.provide();

      expect(service.loggerProvider).toBe(loggerFactory);
      expect(service.loggerProvider).toBeInstanceOf(Factory);

      const logger = service.loggerProvider.provide();
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.log("test")).toBe("LOG: test");
    });

    it("should be resolved to the wrapped provider when nested in objects", () => {
      class Database {
        query(): string {
          return "query result";
        }
      }

      class Service {
        constructor(
          public config: {
            dbProvider: Factory<Database>;
            name: string;
          }
        ) {}
      }

      const dbFactory = new Factory(Database);
      const dbDelegate = new Delegate(dbFactory);
      const serviceFactory = new Factory(Service, {
        dbProvider: dbDelegate,
        name: "test-service",
      });

      const service = serviceFactory.provide();

      expect(service.config.dbProvider).toBe(dbFactory);
      expect(service.config.dbProvider).toBeInstanceOf(Factory);
      expect(service.config.name).toBe("test-service");

      const db = service.config.dbProvider.provide();
      expect(db).toBeInstanceOf(Database);
      expect(db.query()).toBe("query result");
    });

    it("should be resolved to wrapped providers when nested in arrays", () => {
      class Handler {
        handle(): string {
          return "handled";
        }
      }

      class Middleware {
        constructor(public handlerProviders: Factory<Handler>[]) {}
      }

      const handler1Factory = new Factory(Handler);
      const handler2Factory = new Factory(Handler);
      const handler1Delegate = new Delegate(handler1Factory);
      const handler2Delegate = new Delegate(handler2Factory);

      const middlewareFactory = new Factory(Middleware, [
        handler1Delegate,
        handler2Delegate,
      ]);

      const middleware = middlewareFactory.provide();

      expect(middleware.handlerProviders).toHaveLength(2);
      expect(middleware.handlerProviders[0]).toBe(handler1Factory);
      expect(middleware.handlerProviders[1]).toBe(handler2Factory);
      expect(middleware.handlerProviders[0]).toBeInstanceOf(Factory);
      expect(middleware.handlerProviders[1]).toBeInstanceOf(Factory);

      const handler1 = middleware.handlerProviders[0].provide();
      expect(handler1).toBeInstanceOf(Handler);
      expect(handler1.handle()).toBe("handled");
    });
  });

  describe(".provider getter", () => {
    it("should return a Delegate provider from Delegate", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      const loggerFactory = new Factory(Logger);
      const loggerDelegate = new Delegate(loggerFactory);
      const nestedDelegate = loggerDelegate.provider;

      const returnedProvider = nestedDelegate.provide();
      expect(returnedProvider).toBe(loggerDelegate);
    });

    it("should work in dependency injection scenarios", () => {
      class Database {
        query(): string {
          return "query result";
        }
      }

      class Service {
        constructor(public dbProvider: Factory<Database>) {}
      }

      const dbFactory = new Factory(Database);
      const serviceFactory = new Factory(Service, dbFactory.provider);

      const service = serviceFactory.provide();

      expect(service.dbProvider).toBe(dbFactory);
      expect(service.dbProvider).toBeInstanceOf(Factory);

      const db = service.dbProvider.provide();
      expect(db).toBeInstanceOf(Database);
      expect(db.query()).toBe("query result");
    });

    it("should allow chaining .provider multiple times", () => {
      class Service {
        getValue(): string {
          return "value";
        }
      }

      const serviceFactory = new Factory(Service);
      const delegate1 = serviceFactory.provider;
      const delegate2 = delegate1.provider;
      const delegate3 = delegate2.provider;

      const provider1 = delegate3.provide();
      expect(provider1).toBe(delegate2);

      const provider2 = provider1.provide();
      expect(provider2).toBe(delegate1);

      const provider3 = provider2.provide();
      expect(provider3).toBe(serviceFactory);
    });
  });
});

