import { Factory, Singleton } from "../../src/providers";

describe("Provider Override Functionality", () => {
  describe("Basic override behavior", () => {
    it("should override a Factory provider with another Factory", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService {
        getValue(): string {
          return "mocked";
        }
      }

      const serviceFactory = new Factory(Service);
      const mockFactory = new Factory(MockService);

      serviceFactory.override(mockFactory);

      const service = serviceFactory.provide();
      expect(service).toBeInstanceOf(MockService);
      expect(service.getValue()).toBe("mocked");
    });

    it("should override a Singleton provider with a Factory", () => {
      class Database {
        query(): string {
          return "real data";
        }
      }

      class MockDatabase {
        query(): string {
          return "mock data";
        }
      }

      const dbSingleton = new Singleton(Database);
      const mockFactory = new Factory(MockDatabase);

      dbSingleton.override(mockFactory);

      const db = dbSingleton.provide();
      expect(db).toBeInstanceOf(MockDatabase);
      expect(db.query()).toBe("mock data");
    });

    it("should throw error when overriding with non-provider", () => {
      const factory = new Factory(class TestClass {});

      expect(() => {
        factory.override(null as any);
      }).toThrow("Override argument must be a provider with a provide() method");

      expect(() => {
        factory.override({} as any);
      }).toThrow("Override argument must be a provider with a provide() method");

      expect(() => {
        factory.override({ provide: "not a function" } as any);
      }).toThrow("Override argument must be a provider with a provide() method");
    });
  });

  describe("Multiple overrides (stack behavior)", () => {
    it("should use the last override when multiple overrides are applied", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService1 {
        getValue(): string {
          return "mock1";
        }
      }

      class MockService2 {
        getValue(): string {
          return "mock2";
        }
      }

      class MockService3 {
        getValue(): string {
          return "mock3";
        }
      }

      const serviceFactory = new Factory(Service);
      const mock1Factory = new Factory(MockService1);
      const mock2Factory = new Factory(MockService2);
      const mock3Factory = new Factory(MockService3);

      serviceFactory.override(mock1Factory);
      serviceFactory.override(mock2Factory);
      serviceFactory.override(mock3Factory);

      const service = serviceFactory.provide();
      expect(service).toBeInstanceOf(MockService3);
      expect(service.getValue()).toBe("mock3");
    });
  });

  describe("resetLastOverriding()", () => {
    it("should reset the last overriding provider and return it", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService1 {
        getValue(): string {
          return "mock1";
        }
      }

      class MockService2 {
        getValue(): string {
          return "mock2";
        }
      }

      const serviceFactory = new Factory(Service);
      const mock1Factory = new Factory(MockService1);
      const mock2Factory = new Factory(MockService2);

      serviceFactory.override(mock1Factory);
      serviceFactory.override(mock2Factory);

      let service = serviceFactory.provide();
      expect(service.getValue()).toBe("mock2");

      const removed = serviceFactory.resetLastOverriding();
      expect(removed).toBe(mock2Factory);

      service = serviceFactory.provide();
      expect(service.getValue()).toBe("mock1");
    });

    it("should throw error when trying to reset with no overrides", () => {
      const factory = new Factory(class TestClass {});

      expect(() => {
        factory.resetLastOverriding();
      }).toThrow("No overriding providers to reset");
    });

    it("should reset to original provider after removing all overrides one by one", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService1 {
        getValue(): string {
          return "mock1";
        }
      }

      class MockService2 {
        getValue(): string {
          return "mock2";
        }
      }

      const serviceFactory = new Factory(Service);
      const mock1Factory = new Factory(MockService1);
      const mock2Factory = new Factory(MockService2);

      serviceFactory.override(mock1Factory);
      serviceFactory.override(mock2Factory);

      serviceFactory.resetLastOverriding();
      serviceFactory.resetLastOverriding();

      const service = serviceFactory.provide();
      expect(service).toBeInstanceOf(Service);
      expect(service.getValue()).toBe("original");
    });
  });

  describe("resetOverride()", () => {
    it("should reset all overriding providers at once and return them", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService1 {
        getValue(): string {
          return "mock1";
        }
      }

      class MockService2 {
        getValue(): string {
          return "mock2";
        }
      }

      const serviceFactory = new Factory(Service);
      const mock1Factory = new Factory(MockService1);
      const mock2Factory = new Factory(MockService2);

      serviceFactory.override(mock1Factory);
      serviceFactory.override(mock2Factory);

      let service = serviceFactory.provide();
      expect(service.getValue()).toBe("mock2");

      const removed = serviceFactory.resetOverride();
      expect(removed).toEqual([mock1Factory, mock2Factory]);

      service = serviceFactory.provide();
      expect(service).toBeInstanceOf(Service);
      expect(service.getValue()).toBe("original");
    });

    it("should return empty array when called on a provider with no overrides", () => {
      const factory = new Factory(class TestClass {});

      const removed = factory.resetOverride();
      expect(removed).toEqual([]);
    });
  });

  describe("isOverridden()", () => {
    it("should return false when provider is not overridden", () => {
      const factory = new Factory(class TestClass {});
      expect(factory.isOverridden()).toBe(false);
    });

    it("should return true when provider is overridden", () => {
      const factory = new Factory(class TestClass {});
      const mockFactory = new Factory(class MockClass {});

      factory.override(mockFactory);

      expect(factory.isOverridden()).toBe(true);
    });

    it("should return false after all overrides are reset", () => {
      const factory = new Factory(class TestClass {});
      const mockFactory = new Factory(class MockClass {});

      factory.override(mockFactory);
      expect(factory.isOverridden()).toBe(true);

      factory.resetOverride();
      expect(factory.isOverridden()).toBe(false);
    });

    it("should return true after partial reset with remaining overrides", () => {
      const factory = new Factory(class TestClass {});
      const mock1Factory = new Factory(class Mock1Class {});
      const mock2Factory = new Factory(class Mock2Class {});

      factory.override(mock1Factory);
      factory.override(mock2Factory);

      factory.resetLastOverriding();

      expect(factory.isOverridden()).toBe(true);
    });
  });

  describe("overrides getter", () => {
    it("should return empty array when no overrides", () => {
      const factory = new Factory(class TestClass {});

      expect(factory.overrides).toEqual([]);
    });

    it("should return array with all overriding providers", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService1 {
        getValue(): string {
          return "mock1";
        }
      }

      class MockService2 {
        getValue(): string {
          return "mock2";
        }
      }

      const serviceFactory = new Factory(Service);
      const mock1Factory = new Factory(MockService1);
      const mock2Factory = new Factory(MockService2);

      serviceFactory.override(mock1Factory);
      serviceFactory.override(mock2Factory);

      const overrides = serviceFactory.overrides;
      expect(overrides).toEqual([mock1Factory, mock2Factory]);
    });

    it("should return a copy not the original array (readonly)", () => {
      const factory = new Factory(class TestClass {});
      const mockFactory = new Factory(class MockClass {});

      factory.override(mockFactory);

      const overrides1 = factory.overrides;
      const overrides2 = factory.overrides;

      // Should be equal but not the same reference (gets a fresh copy each time)
      expect(overrides1).toEqual(overrides2);
      expect(overrides1).not.toBe(overrides2);

      // The array is readonly and typed as such
      expect(Array.isArray(overrides1)).toBe(true);
      expect(overrides1.length).toBe(1);
    });

    it("should update when overrides are added or removed", () => {
      const factory = new Factory(class TestClass {});
      const mock1Factory = new Factory(class Mock1Class {});
      const mock2Factory = new Factory(class Mock2Class {});

      expect(factory.overrides).toEqual([]);

      factory.override(mock1Factory);
      expect(factory.overrides).toEqual([mock1Factory]);

      factory.override(mock2Factory);
      expect(factory.overrides).toEqual([mock1Factory, mock2Factory]);

      factory.resetLastOverriding();
      expect(factory.overrides).toEqual([mock1Factory]);

      factory.resetOverride();
      expect(factory.overrides).toEqual([]);
    });
  });

  describe("Override with arguments", () => {
    it("should pass provide arguments to the overriding provider", () => {
      class Service {
        constructor(public value: string) {}
      }

      class MockService {
        constructor(public value: string) {}
      }

      const serviceFactory = new Factory(Service);
      const mockFactory = new Factory(MockService);

      serviceFactory.override(mockFactory);

      const service = serviceFactory.provide("test-value");
      expect(service).toBeInstanceOf(MockService);
      expect(service.value).toBe("test-value");
    });

    it("should pass multiple arguments correctly", () => {
      class Calculator {
        add(a: number, b: number): number {
          return a + b;
        }
      }

      class MockCalculator {
        add(a: number, b: number): number {
          return a + b + 100;
        }
      }

      const calcFactory = new Factory(Calculator);
      const mockFactory = new Factory(MockCalculator);

      calcFactory.override(mockFactory);

      const calc = calcFactory.provide();
      expect(calc.add(5, 3)).toBe(108);
    });
  });

  describe("Override with Singleton", () => {
    it("should call the overriding provider instead of using cached instance", () => {
      class Counter {
        private static globalCount = 0;
        public id: number;

        constructor() {
          Counter.globalCount++;
          this.id = Counter.globalCount;
        }
      }

      class MockCounter {
        private static globalCount = 0;
        public id: number;

        constructor() {
          MockCounter.globalCount++;
          this.id = MockCounter.globalCount + 100;
        }
      }

      const counterSingleton = new Singleton(Counter);

      // Create first instance - should be cached
      const instance1 = counterSingleton.provide();
      expect(instance1.id).toBe(1);

      // Second call should return cached instance
      const instance2 = counterSingleton.provide();
      expect(instance2.id).toBe(1);
      expect(instance1).toBe(instance2);

      // Override with factory (not singleton)
      const mockFactory = new Factory(MockCounter);
      counterSingleton.override(mockFactory);

      // Should now create new instances each time
      const mock1 = counterSingleton.provide();
      const mock2 = counterSingleton.provide();
      expect(mock1.id).toBe(101);
      expect(mock2.id).toBe(102);
      expect(mock1).not.toBe(mock2);

      // Reset override - should return to cached singleton instance
      counterSingleton.resetOverride();
      const instance3 = counterSingleton.provide();
      expect(instance3.id).toBe(1);
      expect(instance3).toBe(instance1);
    });

    it("should work with Singleton overriding another Singleton", () => {
      class Database {
        private static instanceCount = 0;
        public id: number;

        constructor() {
          Database.instanceCount++;
          this.id = Database.instanceCount;
        }

        query(): string {
          return `real-${this.id}`;
        }
      }

      class MockDatabase {
        private static instanceCount = 0;
        public id: number;

        constructor() {
          MockDatabase.instanceCount++;
          this.id = MockDatabase.instanceCount;
        }

        query(): string {
          return `mock-${this.id}`;
        }
      }

      const dbSingleton = new Singleton(Database);
      const mockDbSingleton = new Singleton(MockDatabase);

      dbSingleton.override(mockDbSingleton);

      const db1 = dbSingleton.provide();
      const db2 = dbSingleton.provide();

      expect(db1.query()).toBe("mock-1");
      expect(db2.query()).toBe("mock-1");
      expect(db1).toBe(db2); // Mock singleton should also cache
    });
  });

  describe("Override with Delegate", () => {
    it("should override Delegate provider", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService {
        getValue(): string {
          return "mocked";
        }
      }

      const serviceFactory = new Factory(Service);
      const mockFactory = new Factory(MockService);
      const delegateProvider = serviceFactory.provider;

      // Create a delegate for the mock factory to match the type
      const mockDelegate = mockFactory.provider;
      delegateProvider.override(mockDelegate);

      const provider = delegateProvider.provide();
      expect(provider).toBe(mockFactory);
    });

    it("should work with Delegate wrapping an overridden provider", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService {
        getValue(): string {
          return "mocked";
        }
      }

      const serviceFactory = new Factory(Service);
      const mockFactory = new Factory(MockService);

      // Override the original factory
      serviceFactory.override(mockFactory);

      // Get delegate of the overridden factory
      const delegateProvider = serviceFactory.provider;
      const provider = delegateProvider.provide();

      // The delegate should still return the original factory
      expect(provider).toBe(serviceFactory);

      // But calling provide on it should return mocked instance
      const service = provider.provide();
      expect(service).toBeInstanceOf(MockService);
      expect(service.getValue()).toBe("mocked");
    });
  });

  describe("Override with injected dependencies", () => {
    it("should work correctly with providers that have injected dependencies", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      class MockLogger {
        log(message: string): string {
          return `MOCK LOG: ${message}`;
        }
      }

      class Service {
        constructor(public logger: Logger) {}

        doSomething(): string {
          return this.logger.log("doing something");
        }
      }

      class MockService {
        constructor(public logger: MockLogger) {}

        doSomething(): string {
          return this.logger.log("doing mock something");
        }
      }

      const loggerFactory = new Factory(Logger);
      const mockLoggerFactory = new Factory(MockLogger);
      const serviceFactory = new Factory(Service, loggerFactory);
      const mockServiceFactory = new Factory(MockService, mockLoggerFactory);

      // Override service
      serviceFactory.override(mockServiceFactory);

      const service = serviceFactory.provide();
      expect(service.doSomething()).toBe("MOCK LOG: doing mock something");
    });

    it("should allow overriding individual dependencies", () => {
      class Logger {
        log(message: string): string {
          return `LOG: ${message}`;
        }
      }

      class MockLogger {
        log(message: string): string {
          return `MOCK LOG: ${message}`;
        }
      }

      class Service {
        constructor(public logger: Logger) {}

        doSomething(): string {
          return this.logger.log("doing something");
        }
      }

      const loggerFactory = new Factory(Logger);
      const mockLoggerFactory = new Factory(MockLogger);
      const serviceFactory = new Factory(Service, loggerFactory);

      // Override only the logger
      loggerFactory.override(mockLoggerFactory);

      const service = serviceFactory.provide();
      expect(service).toBeInstanceOf(Service);
      expect(service.doSomething()).toBe("MOCK LOG: doing something");
    });
  });

  describe("Complex override scenarios", () => {
    it("should handle nested provider dependency graphs with overrides", () => {
      class Config {
        getDbHost(): string {
          return "prod.db.com";
        }
      }

      class MockConfig {
        getDbHost(): string {
          return "test.db.com";
        }
      }

      class Logger {
        log(message: string): string {
          return `[LOG] ${message}`;
        }
      }

      class Database {
        constructor(
          public config: Config,
          public logger: Logger
        ) {}

        connect(): string {
          this.logger.log(`Connecting to ${this.config.getDbHost()}`);
          return `Connected to ${this.config.getDbHost()}`;
        }
      }

      class UserService {
        constructor(public db: Database) {}

        getUser(): string {
          return this.db.connect();
        }
      }

      const configFactory = new Factory(Config);
      const mockConfigFactory = new Factory(MockConfig);
      const loggerFactory = new Factory(Logger);
      const dbFactory = new Factory(Database, configFactory, loggerFactory);
      const userServiceFactory = new Factory(UserService, dbFactory);

      // Override config
      configFactory.override(mockConfigFactory);

      const userService = userServiceFactory.provide();
      expect(userService.getUser()).toBe("Connected to test.db.com");

      // Reset override
      configFactory.resetOverride();

      const userService2 = userServiceFactory.provide();
      expect(userService2.getUser()).toBe("Connected to prod.db.com");
    });

    it("should handle multiple independent overrides in a dependency graph", () => {
      class Logger {
        log(message: string): string {
          return `[LOG] ${message}`;
        }
      }

      class MockLogger {
        log(message: string): string {
          return `[MOCK] ${message}`;
        }
      }

      class Cache {
        get(_key: string): string {
          return "cached-value";
        }
      }

      class MockCache {
        get(_key: string): string {
          return "mock-cached-value";
        }
      }

      class Service {
        constructor(
          public logger: Logger,
          public cache: Cache
        ) {}

        process(): string {
          const value = this.cache.get("key");
          this.logger.log("processing");
          return value;
        }
      }

      const loggerFactory = new Factory(Logger);
      const mockLoggerFactory = new Factory(MockLogger);
      const cacheFactory = new Factory(Cache);
      const mockCacheFactory = new Factory(MockCache);
      const serviceFactory = new Factory(Service, loggerFactory, cacheFactory);

      // Override both dependencies
      loggerFactory.override(mockLoggerFactory);
      cacheFactory.override(mockCacheFactory);

      const service = serviceFactory.provide();
      expect(service.logger).toBeInstanceOf(MockLogger);
      expect(service.cache).toBeInstanceOf(MockCache);
      expect(service.process()).toBe("mock-cached-value");

      // Reset only logger
      loggerFactory.resetOverride();

      const service2 = serviceFactory.provide();
      expect(service2.logger).toBeInstanceOf(Logger);
      expect(service2.cache).toBeInstanceOf(MockCache);
      expect(service2.process()).toBe("mock-cached-value");
    });
  });

  describe("Edge cases", () => {
    it("should work with function factories", () => {
      const createService = (): { getValue: () => string } => ({
        getValue: () => "original",
      });

      const createMockService = (): { getValue: () => string } => ({
        getValue: () => "mocked",
      });

      const serviceFactory = new Factory(createService);
      const mockFactory = new Factory(createMockService);

      serviceFactory.override(mockFactory);

      const service = serviceFactory.provide();
      expect(service.getValue()).toBe("mocked");
    });

    it("should handle override/reset cycles correctly", () => {
      class Service {
        getValue(): string {
          return "original";
        }
      }

      class MockService {
        getValue(): string {
          return "mocked";
        }
      }

      const serviceFactory = new Factory(Service);
      const mockFactory = new Factory(MockService);

      // Multiple override/reset cycles
      for (let i = 0; i < 3; i++) {
        serviceFactory.override(mockFactory);
        expect(serviceFactory.provide().getValue()).toBe("mocked");

        serviceFactory.resetOverride();
        expect(serviceFactory.provide().getValue()).toBe("original");
      }
    });

    it("should maintain separate override stacks for different providers", () => {
      class Service1 {
        getValue(): string {
          return "service1";
        }
      }

      class Service2 {
        getValue(): string {
          return "service2";
        }
      }

      class MockService1 {
        getValue(): string {
          return "mock1";
        }
      }

      class MockService2 {
        getValue(): string {
          return "mock2";
        }
      }

      const factory1 = new Factory(Service1);
      const factory2 = new Factory(Service2);
      const mockFactory1 = new Factory(MockService1);
      const mockFactory2 = new Factory(MockService2);

      factory1.override(mockFactory1);
      factory2.override(mockFactory2);

      expect(factory1.provide().getValue()).toBe("mock1");
      expect(factory2.provide().getValue()).toBe("mock2");

      factory1.resetOverride();

      expect(factory1.provide().getValue()).toBe("service1");
      expect(factory2.provide().getValue()).toBe("mock2");
    });
  });
});
