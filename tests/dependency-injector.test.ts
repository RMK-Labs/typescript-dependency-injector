import { Factory, Singleton } from "../src/dependency-injector";

describe("Dependency Injector - Auto Provider Resolution", () => {
  describe("Basic Provider resolution", () => {
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

    it("should resolve Singleton providers", () => {
      class Counter {
        private count = 0;
        increment(): number {
          return ++this.count;
        }
      }

      class Service {
        constructor(public counter: Counter) {}
      }

      const counterSingleton = new Singleton(Counter);
      const serviceFactory1 = new Factory(Service, counterSingleton);
      const serviceFactory2 = new Factory(Service, counterSingleton);

      const service1 = serviceFactory1.provide();
      const service2 = serviceFactory2.provide();

      expect(service1.counter.increment()).toBe(1);
      expect(service2.counter.increment()).toBe(2);
      expect(service1.counter).toBe(service2.counter);
    });
  });

  describe("Nested object resolution", () => {
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
      expect(service.config.data.primary.db).not.toBe(
        service.config.data.backup.db
      );
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
      circularObj.self = circularObj;

      const serviceFactory = new Factory(Service, circularObj);
      const service = serviceFactory.provide();

      expect(service.config.name).toBe("test");
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

  describe("Complex real-world scenarios", () => {
    it("should handle a complex dependency graph", () => {
      class Logger {
        log(msg: string): string {
          return `[LOG] ${msg}`;
        }
      }

      class Database {
        query(): string {
          return "query-result";
        }
      }

      class Cache {
        get(key: string): string | null {
          return null;
        }
      }

      class UserRepository {
        constructor(
          public config: {
            db: Database;
            cache: Cache;
            logger: Logger;
          }
        ) {}

        findUser(id: string): string {
          this.config.logger.log(`Finding user ${id}`);
          return this.config.db.query();
        }
      }

      class UserService {
        constructor(
          public config: {
            userRepo: UserRepository;
            logger: Logger;
          }
        ) {}
      }

      const loggerSingleton = new Singleton(Logger);
      const dbFactory = new Factory(Database);
      const cacheFactory = new Factory(Cache);

      const userRepoFactory = new Factory(UserRepository, {
        db: dbFactory,
        cache: cacheFactory,
        logger: loggerSingleton,
      });

      const userServiceFactory = new Factory(UserService, {
        userRepo: userRepoFactory,
        logger: loggerSingleton,
      });

      const service = userServiceFactory.provide();

      expect(service.config.userRepo).toBeInstanceOf(UserRepository);
      expect(service.config.userRepo.config.db).toBeInstanceOf(Database);
      expect(service.config.userRepo.config.cache).toBeInstanceOf(Cache);
      expect(service.config.userRepo.config.logger).toBeInstanceOf(Logger);
      expect(service.config.logger).toBeInstanceOf(Logger);

      // Verify singleton behavior
      expect(service.config.logger).toBe(
        service.config.userRepo.config.logger
      );

      // Verify functionality
      expect(service.config.userRepo.findUser("123")).toBe("query-result");
    });
  });

  describe("Edge cases", () => {
    it("should NOT resolve objects with provide() methods that are not Providers", () => {
      // Simulates AWS SDK clients or other third-party objects with provide() methods
      class ThirdPartyClient {
        provide(): string {
          return "third-party-data";
        }
        send(command: any): string {
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
});

