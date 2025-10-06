import { Factory, Singleton } from "../../src/providers";

describe("Singleton Provider", () => {
  describe("Basic singleton behavior", () => {
    it("should return the same instance on multiple provide() calls", () => {
      class Counter {
        private count = 0;
        increment(): number {
          return ++this.count;
        }
      }

      const counterSingleton = new Singleton(Counter);

      const instance1 = counterSingleton.provide();
      const instance2 = counterSingleton.provide();

      expect(instance1).toBeInstanceOf(Counter);
      expect(instance2).toBeInstanceOf(Counter);
      expect(instance1).toBe(instance2);
    });

    it("should maintain state across multiple provide() calls", () => {
      class Counter {
        private count = 0;
        increment(): number {
          return ++this.count;
        }
      }

      const counterSingleton = new Singleton(Counter);

      const instance1 = counterSingleton.provide();
      const instance2 = counterSingleton.provide();

      expect(instance1.increment()).toBe(1);
      expect(instance2.increment()).toBe(2);
      expect(instance1).toBe(instance2);
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

  describe("Singleton with dependencies", () => {
    it("should create singleton with injected dependencies", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      class Database {
        constructor(public logger: Logger) {}
        query(): string {
          this.logger.log("querying");
          return "data";
        }
      }

      const loggerFactory = new Factory(Logger);
      const dbSingleton = new Singleton(Database, loggerFactory);

      const db1 = dbSingleton.provide();
      const db2 = dbSingleton.provide();

      expect(db1).toBe(db2);
      expect(db1.logger).toBeInstanceOf(Logger);
      expect(db1.query()).toBe("data");
    });

    it("should work in complex dependency graphs with shared singletons", () => {
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
        get(_key: string): string | null {
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

  describe(".provider getter", () => {
    it("should return a Delegate provider from Singleton", () => {
      class Counter {
        private count = 0;
        increment(): number {
          return ++this.count;
        }
      }

      const counterSingleton = new Singleton(Counter);
      const counterDelegate = counterSingleton.provider;

      const returnedProvider = counterDelegate.provide();
      expect(returnedProvider).toBe(counterSingleton);
    });

    it("should work with Singleton behavior preserved through Delegate", () => {
      class SharedResource {
        private counter = 0;
        increment(): number {
          return ++this.counter;
        }
      }

      class Service1 {
        constructor(public resourceProvider: Singleton<SharedResource>) {}
      }

      class Service2 {
        constructor(public resourceProvider: Singleton<SharedResource>) {}
      }

      const resourceSingleton = new Singleton(SharedResource);
      const service1Factory = new Factory(Service1, resourceSingleton.provider);
      const service2Factory = new Factory(Service2, resourceSingleton.provider);

      const service1 = service1Factory.provide();
      const service2 = service2Factory.provide();

      expect(service1.resourceProvider).toBe(resourceSingleton);
      expect(service2.resourceProvider).toBe(resourceSingleton);

      const resource1 = service1.resourceProvider.provide();
      const resource2 = service2.resourceProvider.provide();

      expect(resource1.increment()).toBe(1);
      expect(resource2.increment()).toBe(2);
      expect(resource1).toBe(resource2);
    });
  });
});

