import { Factory } from "../../src/providers";

describe("Factory Provider", () => {
  describe("Basic instantiation", () => {
    it("should create a new instance each time provide() is called", () => {
      class Counter {
        private count = 0;
        increment(): number {
          return ++this.count;
        }
      }

      const factory = new Factory(Counter);
      const instance1 = factory.provide();
      const instance2 = factory.provide();

      expect(instance1).toBeInstanceOf(Counter);
      expect(instance2).toBeInstanceOf(Counter);
      expect(instance1).not.toBe(instance2);

      expect(instance1.increment()).toBe(1);
      expect(instance2.increment()).toBe(1);
    });

    it("should instantiate a class without dependencies", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      const factory = new Factory(Logger);
      const logger = factory.provide();

      expect(logger).toBeInstanceOf(Logger);
      expect(logger.log("test")).toBe("LOG: test");
    });
  });

  describe("Injected arguments", () => {
    it("should resolve a Provider passed as injectedArg", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      class Service {
        constructor(public logger: Logger) {}
      }

      const loggerFactory = new Factory(Logger);
      const serviceFactory = new Factory(Service, loggerFactory);

      const service = serviceFactory.provide();

      expect(service.logger).toBeInstanceOf(Logger);
      expect(service.logger.log("test")).toBe("LOG: test");
    });

    it("should resolve Providers inside object literals", () => {
      class Database {
        query(): string {
          return "query result";
        }
      }

      class Service {
        constructor(
          public config: {
            db: Database;
            name: string;
            port: number;
          }
        ) {}
      }

      const dbFactory = new Factory(Database);
      const serviceFactory = new Factory(Service, {
        db: dbFactory,
        name: "test-service",
        port: 3000,
      });

      const service = serviceFactory.provide();

      expect(service.config.db).toBeInstanceOf(Database);
      expect(service.config.db.query()).toBe("query result");
      expect(service.config.name).toBe("test-service");
      expect(service.config.port).toBe(3000);
    });

    it("should handle multiple injected arguments", () => {
      class Logger {
        log(msg: string): string {
          return msg;
        }
      }

      class Database {
        query(): string {
          return "data";
        }
      }

      class Service {
        constructor(public logger: Logger, public db: Database) {}
      }

      const loggerFactory = new Factory(Logger);
      const dbFactory = new Factory(Database);
      const serviceFactory = new Factory(Service, loggerFactory, dbFactory);

      const service = serviceFactory.provide();

      expect(service.logger).toBeInstanceOf(Logger);
      expect(service.db).toBeInstanceOf(Database);
    });
  });

  describe("Nested Providers", () => {
    it("should resolve deeply nested Providers", () => {
      class Logger {
        log(msg: string): string {
          return msg;
        }
      }

      class Database {
        query(): string {
          return "data";
        }
      }

      class Service {
        constructor(
          public config: {
            logging: {
              logger: Logger;
              level: string;
            };
            data: {
              primary: {
                db: Database;
                host: string;
              };
              backup: {
                db: Database;
                host: string;
              };
            };
          }
        ) {}
      }

      const loggerFactory = new Factory(Logger);
      const primaryDbFactory = new Factory(Database);
      const backupDbFactory = new Factory(Database);

      const serviceFactory = new Factory(Service, {
        logging: {
          logger: loggerFactory,
          level: "info",
        },
        data: {
          primary: {
            db: primaryDbFactory,
            host: "primary.db.local",
          },
          backup: {
            db: backupDbFactory,
            host: "backup.db.local",
          },
        },
      });

      const service = serviceFactory.provide();

      expect(service.config.logging.logger).toBeInstanceOf(Logger);
      expect(service.config.logging.level).toBe("info");
      expect(service.config.data.primary.db).toBeInstanceOf(Database);
      expect(service.config.data.backup.db).toBeInstanceOf(Database);
      expect(service.config.data.primary.db).not.toBe(service.config.data.backup.db);
    });

    it("should handle nested Providers with multiple levels", () => {
      class Level3 {
        value = "level3";
      }
      class Level2 {
        constructor(public dep: Level3) {}
      }
      class Level1 {
        constructor(public dep: Level2) {}
      }
      class Service {
        constructor(public dep: Level1) {}
      }

      const level3Factory = new Factory(Level3);
      const level2Factory = new Factory(Level2, level3Factory);
      const level1Factory = new Factory(Level1, level2Factory);
      const serviceFactory = new Factory(Service, level1Factory);

      const service = serviceFactory.provide();

      expect(service.dep).toBeInstanceOf(Level1);
      expect(service.dep.dep).toBeInstanceOf(Level2);
      expect(service.dep.dep.dep).toBeInstanceOf(Level3);
      expect(service.dep.dep.dep.value).toBe("level3");
    });
  });

  describe("Array resolution", () => {
    it("should resolve Providers inside arrays", () => {
      class Handler {
        handle(): string {
          return "handled";
        }
      }

      class Middleware {
        constructor(public handlers: Handler[]) {}
      }

      const handler1Factory = new Factory(Handler);
      const handler2Factory = new Factory(Handler);
      const handler3Factory = new Factory(Handler);

      const middlewareFactory = new Factory(Middleware, [
        handler1Factory,
        handler2Factory,
        handler3Factory,
      ]);

      const middleware = middlewareFactory.provide();

      expect(middleware.handlers).toHaveLength(3);
      expect(middleware.handlers[0]).toBeInstanceOf(Handler);
      expect(middleware.handlers[1]).toBeInstanceOf(Handler);
      expect(middleware.handlers[2]).toBeInstanceOf(Handler);
      expect(middleware.handlers[0].handle()).toBe("handled");
    });

    it("should resolve mixed arrays with Providers and primitives", () => {
      class Plugin {
        name = "plugin";
      }

      class App {
        constructor(public config: any[]) {}
      }

      const pluginFactory = new Factory(Plugin);
      const appFactory = new Factory(App, [
        "string-value",
        42,
        pluginFactory,
        { key: "value" },
        true,
      ]);

      const app = appFactory.provide();

      expect(app.config).toHaveLength(5);
      expect(app.config[0]).toBe("string-value");
      expect(app.config[1]).toBe(42);
      expect(app.config[2]).toBeInstanceOf(Plugin);
      expect(app.config[3]).toEqual({ key: "value" });
      expect(app.config[4]).toBe(true);
    });
  });

  describe("Map and Set resolution", () => {
    it("should resolve Providers inside Map values", () => {
      class Handler {
        handle(): string {
          return "handled";
        }
      }

      class Router {
        constructor(public routes: Map<string, Handler>) {}
      }

      const getHandlerFactory = new Factory(Handler);
      const postHandlerFactory = new Factory(Handler);

      const routesMap = new Map<string, any>();
      routesMap.set("GET", getHandlerFactory);
      routesMap.set("POST", postHandlerFactory);

      const routerFactory = new Factory(Router, routesMap);
      const router = routerFactory.provide();

      expect(router.routes.get("GET")).toBeInstanceOf(Handler);
      expect(router.routes.get("POST")).toBeInstanceOf(Handler);
      expect(router.routes.get("GET")!.handle()).toBe("handled");
    });

    it("should resolve Providers inside Set values", () => {
      class Service {
        name = "service";
      }

      class ServiceRegistry {
        constructor(public services: Set<Service>) {}
      }

      const service1Factory = new Factory(Service);
      const service2Factory = new Factory(Service);

      const servicesSet = new Set<any>();
      servicesSet.add(service1Factory);
      servicesSet.add(service2Factory);

      const registryFactory = new Factory(ServiceRegistry, servicesSet);
      const registry = registryFactory.provide();

      expect(registry.services.size).toBe(2);
      const servicesArray = Array.from(registry.services);
      expect(servicesArray[0]).toBeInstanceOf(Service);
      expect(servicesArray[1]).toBeInstanceOf(Service);
    });
  });

  describe("Special types handling", () => {
    it("should preserve Date objects without traversing", () => {
      class Service {
        constructor(
          public config: {
            createdAt: Date;
            name: string;
          }
        ) {}
      }

      const now = new Date("2025-01-01T00:00:00Z");
      const serviceFactory = new Factory(Service, {
        createdAt: now,
        name: "test",
      });

      const service = serviceFactory.provide();

      expect(service.config.createdAt).toBe(now);
      expect(service.config.createdAt.getTime()).toBe(now.getTime());
    });

    it("should preserve RegExp objects without traversing", () => {
      class Validator {
        constructor(public pattern: RegExp) {}
      }

      const pattern = /^[a-z0-9]+$/;
      const validatorFactory = new Factory(Validator, pattern);

      const validator = validatorFactory.provide();

      expect(validator.pattern).toBe(pattern);
      expect(validator.pattern.test("abc123")).toBe(true);
    });

    it("should preserve function references", () => {
      class Service {
        constructor(public callback: () => string) {}
      }

      const callback = () => "callback result";
      const serviceFactory = new Factory(Service, callback);

      const service = serviceFactory.provide();

      expect(service.callback).toBe(callback);
      expect(service.callback()).toBe("callback result");
    });

    it("should handle null and undefined", () => {
      class Service {
        constructor(
          public config: {
            nullValue: null;
            undefinedValue: undefined;
            stringValue: string;
          }
        ) {}
      }

      const serviceFactory = new Factory(Service, {
        nullValue: null,
        undefinedValue: undefined,
        stringValue: "test",
      });

      const service = serviceFactory.provide();

      expect(service.config.nullValue).toBeNull();
      expect(service.config.undefinedValue).toBeUndefined();
      expect(service.config.stringValue).toBe("test");
    });
  });

  describe("Circular reference handling", () => {
    it("should handle circular references in objects", () => {
      class Service {
        constructor(public config: any) {}
      }

      const circularObj: any = { name: "test" };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      circularObj.self = circularObj;

      const serviceFactory = new Factory(Service, circularObj);
      const service = serviceFactory.provide();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(service.config.name).toBe("test");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(service.config.self).toBe(service.config);
    });

    it("should handle circular references in arrays", () => {
      class Service {
        constructor(public items: any[]) {}
      }

      const circularArray: any[] = [1, 2, 3];
      circularArray.push(circularArray);

      const serviceFactory = new Factory(Service, circularArray);
      const service = serviceFactory.provide();

      expect(service.items[0]).toBe(1);
      expect(service.items[1]).toBe(2);
      expect(service.items[2]).toBe(3);
      expect(service.items[3]).toBe(service.items);
    });
  });

  describe("Edge cases", () => {
    it("should NOT resolve objects with provide() methods that are not Providers", () => {
      // Simulates AWS SDK clients or other third-party objects with provide() methods
      class ThirdPartyClient {
        provide(): string {
          return "third-party-data";
        }
        send(_command: any): string {
          return "sent";
        }
      }

      class Service {
        constructor(public client: ThirdPartyClient) {}
      }

      const thirdPartyClient = new ThirdPartyClient();
      const serviceFactory = new Factory(Service, thirdPartyClient);
      const service = serviceFactory.provide();

      // Should NOT call provide() on third-party client
      expect(service.client).toBe(thirdPartyClient);
      expect(service.client.send("test")).toBe("sent");
    });

    it("should handle empty objects", () => {
      class Service {
        constructor(public config: object) {}
      }

      const serviceFactory = new Factory(Service, {});
      const service = serviceFactory.provide();

      expect(service.config).toEqual({});
    });

    it("should handle empty arrays", () => {
      class Service {
        constructor(public items: any[]) {}
      }

      const serviceFactory = new Factory(Service, []);
      const service = serviceFactory.provide();

      expect(service.items).toEqual([]);
    });
  });

  describe(".provider getter", () => {
    it("should return a Delegate provider from Factory", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      const loggerFactory = new Factory(Logger);
      const loggerDelegate = loggerFactory.provider;

      const returnedProvider = loggerDelegate.provide();
      expect(returnedProvider).toBe(loggerFactory);
    });

    it("should return a new Delegate instance on each .provider call", () => {
      class Service {
        getValue(): string {
          return "value";
        }
      }

      const serviceFactory = new Factory(Service);
      const delegate1 = serviceFactory.provider;
      const delegate2 = serviceFactory.provider;

      expect(delegate1).not.toBe(delegate2);

      const provider1 = delegate1.provide();
      const provider2 = delegate2.provide();

      expect(provider1).toBe(serviceFactory);
      expect(provider2).toBe(serviceFactory);
    });
  });

  describe("Factory functions (non-constructor)", () => {
    it("should support factory functions instead of constructors", () => {
      interface Logger {
        log(message: string): string;
      }

      function createLogger(): Logger {
        return {
          log: (message: string) => `LOG: ${message}`,
        };
      }

      const loggerFactory = new Factory(createLogger);
      const logger1 = loggerFactory.provide();
      const logger2 = loggerFactory.provide();

      expect(logger1.log("test")).toBe("LOG: test");
      expect(logger2.log("test")).toBe("LOG: test");
      expect(logger1).not.toBe(logger2);
    });

    it("should resolve Provider arguments in factory functions", () => {
      interface Config {
        host: string;
        port: number;
      }

      interface Database {
        query(): string;
        config: Config;
      }

      function createConfig(): Config {
        return { host: "localhost", port: 5432 };
      }

      function createDatabase(config: Config): Database {
        return {
          config,
          query: () => `Connected to ${config.host}:${config.port}`,
        };
      }

      const configFactory = new Factory(createConfig);
      const dbFactory = new Factory(createDatabase, configFactory);

      const db = dbFactory.provide();

      expect(db.config.host).toBe("localhost");
      expect(db.config.port).toBe(5432);
      expect(db.query()).toBe("Connected to localhost:5432");
    });

    it("should support arrow functions as factory functions", () => {
      interface Counter {
        count: number;
        increment(): number;
      }

      const createCounter = (): Counter => ({
        count: 0,
        increment() {
          return ++this.count;
        },
      });

      const counterFactory = new Factory(createCounter);
      const counter1 = counterFactory.provide();
      const counter2 = counterFactory.provide();

      expect(counter1.increment()).toBe(1);
      expect(counter1.increment()).toBe(2);
      expect(counter2.increment()).toBe(1);
      expect(counter1).not.toBe(counter2);
    });

    it("should support factory methods", () => {
      class Logger {
        static create(): Logger {
          return new Logger();
        }

        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      // Bind the method to avoid unbound method warning
      const createLogger = Logger.create.bind(Logger);
      const loggerFactory = new Factory(createLogger);
      const logger = loggerFactory.provide();

      expect(logger).toBeInstanceOf(Logger);
      expect(logger.log("test")).toBe("LOG: test");
    });

    it("should handle factory functions with provide() arguments", () => {
      interface Service {
        name: string;
        port: number;
        getValue(): string;
      }

      function createService(name: string, port: number): Service {
        return {
          name,
          port,
          getValue: () => `${name}:${port}`,
        };
      }

      const serviceFactory = new Factory<Service, [string, number]>(createService);
      const service = serviceFactory.provide("api-service", 3000);

      expect(service.name).toBe("api-service");
      expect(service.port).toBe(3000);
      expect(service.getValue()).toBe("api-service:3000");
    });

    it("should resolve nested Providers with factory functions", () => {
      interface Logger {
        log(msg: string): string;
      }

      interface Config {
        logger: Logger;
        name: string;
      }

      interface Service {
        config: Config;
        run(): string;
      }

      const createLogger = (): Logger => ({
        log: (msg: string) => `[LOG] ${msg}`,
      });

      const createService = (config: Config): Service => ({
        config,
        run: () => config.logger.log(`Running ${config.name}`),
      });

      const loggerFactory = new Factory(createLogger);
      const serviceFactory = new Factory(createService, {
        logger: loggerFactory,
        name: "test-service",
      });

      const service = serviceFactory.provide();

      expect(service.config.name).toBe("test-service");
      expect(service.run()).toBe("[LOG] Running test-service");
    });
  });
});
