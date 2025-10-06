import { DeclarativeContainer, Factory, Singleton, createInject, Provide, getInjectedParamIds, getMarkerFor } from "../src";

// Domain classes for testing
class DatabaseConfig {
  constructor(public host: string, public port: number, public database: string) {}
}

class Database {
  constructor(public config: DatabaseConfig) {}

  query(sql: string): string {
    return `[${this.config.database}@${this.config.host}:${this.config.port}] Executing: ${sql}`;
  }
}

class UserService {
  constructor(private db: Database) {}

  findUser(id: number): string {
    return this.db.query(`SELECT * FROM users WHERE id = ${id}`);
  }
}

class Logger {
  log(message: string): string {
    return `[LOG] ${message}`;
  }
}

// Test container
class TestContainer extends DeclarativeContainer {
  dbConfig = new Factory(DatabaseConfig, "localhost", 5432, "testdb");
  database = new Singleton(Database, this.dbConfig);
  userService = new Singleton(UserService, this.database);
  logger = new Singleton(Logger);
}

describe("createInject", () => {
  describe("basic functionality", () => {
    it("should create injectable markers from a container class", () => {
      const Inject = createInject({ containerClass: TestContainer });

      expect(Inject).toBeDefined();
      expect(Inject.dbConfig).toBeDefined();
      expect(Inject.database).toBeDefined();
      expect(Inject.userService).toBeDefined();
      expect(Inject.logger).toBeDefined();
    });

    it("should create parameter decorators", () => {
      const Inject = createInject({ containerClass: TestContainer });

      expect(typeof Inject.dbConfig).toBe("function");
      expect(typeof Inject.database).toBe("function");
      expect(typeof Inject.userService).toBe("function");
      expect(typeof Inject.logger).toBe("function");
    });

    it("should only include provider properties", () => {
      class ContainerWithNonProviders extends DeclarativeContainer {
        provider = new Singleton(Logger);
        notAProvider = 42;
        alsoNotAProvider = "string";
      }

      const Inject = createInject({ containerClass: ContainerWithNonProviders });

      expect(Inject.provider).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((Inject as any).notAProvider).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((Inject as any).alsoNotAProvider).toBeUndefined();
    });
  });

  describe("parameter decoration", () => {
    it("should register injection metadata when decorators are applied", () => {
      const Inject = createInject({ containerClass: TestContainer });

      class TestClass {
        method(@Inject.userService service: UserService = Provide(UserService)) {
          return service;
        }
      }

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const paramIds = getInjectedParamIds(TestClass.prototype.method);

      expect(paramIds).toBeDefined();
      expect(paramIds?.size).toBe(1);
      expect(paramIds?.has(0)).toBe(true);
    });

    it("should register multiple injection parameters", () => {
      const Inject = createInject({ containerClass: TestContainer });

      class TestClass {
        method(
          @Inject.database db: Database = Provide(Database),
          @Inject.logger log: Logger = Provide(Logger)
        ) {
          return { db, log };
        }
      }

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const paramIds = getInjectedParamIds(TestClass.prototype.method);

      expect(paramIds).toBeDefined();
      expect(paramIds?.size).toBe(2);
      expect(paramIds?.has(0)).toBe(true);
      expect(paramIds?.has(1)).toBe(true);
    });

    it("should support decorating class method parameters with non-adjacent positions", () => {
      const Inject = createInject({ containerClass: TestContainer });

      class TestClass {
        method(
          regularParam: string,
          @Inject.userService service: UserService = Provide(UserService)
        ): string {
          return `${regularParam}:${service.constructor.name}`;
        }
      }

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const paramIds = getInjectedParamIds(TestClass.prototype.method);

      expect(paramIds).toBeDefined();
      expect(paramIds?.size).toBe(1);
      expect(paramIds?.has(1)).toBe(true); // Second parameter (index 1)
    });
  });

  describe("marker tokens", () => {
    it("should generate consistent tokens for the same container and key", () => {
      const marker1 = getMarkerFor(TestContainer, "userService");
      const marker2 = getMarkerFor(TestContainer, "userService");

      expect(marker1).toBe(marker2);
      expect(typeof marker1).toBe("symbol");
    });

    it("should generate different tokens for different keys", () => {
      const marker1 = getMarkerFor(TestContainer, "userService");
      const marker2 = getMarkerFor(TestContainer, "database");

      expect(marker1).not.toBe(marker2);
    });

    it("should generate different tokens for different containers", () => {
      class AnotherContainer extends DeclarativeContainer {
        dbConfig = new Factory(DatabaseConfig, "localhost", 5432, "otherdb");
        database = new Singleton(Database, this.dbConfig);
        userService = new Singleton(UserService, this.database);
      }

      const marker1 = getMarkerFor(TestContainer, "userService");
      const marker2 = getMarkerFor(AnotherContainer, "userService");

      expect(marker1).not.toBe(marker2);
    });
  });

  describe("Provide() function", () => {
    it("should return undefined", () => {
      const result = Provide(UserService);
      expect(result).toBeUndefined();
    });

    it("should work with any type parameter", () => {
      const result1 = Provide(Database);
      const result2 = Provide(Logger);
      const result3 = Provide(String);

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
      expect(result3).toBeUndefined();
    });

    it("should satisfy TypeScript types without runtime value", () => {
      // This test verifies that Provide() can be used as a default parameter
      // The actual injection would be handled by a runtime injector (not tested here)
      const Inject = createInject({ containerClass: TestContainer });

      class TestClass {
        method(@Inject.userService service: UserService = Provide(UserService)) {
          // In real usage, the decorator would replace the undefined with actual value
          return service;
        }
      }

      // Verify the decoration happened
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const paramIds = getInjectedParamIds(TestClass.prototype.method);
      expect(paramIds?.size).toBe(1);
    });
  });

  describe("example scenario from example-container-inject.ts", () => {
    it("should work with the example container setup", () => {
      class AppContainer extends DeclarativeContainer {
        dbConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.dbConfig);
        userService = new Singleton(UserService, this.database);
      }

      const Inject = createInject({ containerClass: AppContainer });

      class Program {
        main(
          @Inject.userService userService: UserService = Provide(UserService),
        ) {
          return userService.findUser(123);
        }
      }

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const paramIds = getInjectedParamIds(Program.prototype.main);

      expect(paramIds).toBeDefined();
      expect(paramIds?.size).toBe(1);
      expect(paramIds?.has(0)).toBe(true);
    });

    it("should create proper singleton instances from container", () => {
      class AppContainer extends DeclarativeContainer {
        dbConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.dbConfig);
        userService = new Singleton(UserService, this.database);
      }

      const container = new AppContainer();
      const service1 = container.userService.provide();
      const service2 = container.userService.provide();

      expect(service1).toBe(service2);
      expect(service1).toBeInstanceOf(UserService);
    });

    it("should create separate instances for different containers", () => {
      class AppContainer extends DeclarativeContainer {
        dbConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.dbConfig);
        userService = new Singleton(UserService, this.database);
      }

      const container1 = new AppContainer();
      const container2 = new AppContainer();

      const service1 = container1.userService.provide();
      const service2 = container2.userService.provide();

      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(UserService);
      expect(service2).toBeInstanceOf(UserService);
    });
  });

  describe("edge cases", () => {
    it("should handle empty containers", () => {
      class EmptyContainer extends DeclarativeContainer {}

      const Inject = createInject({ containerClass: EmptyContainer });

      expect(Inject).toBeDefined();
      expect(Object.keys(Inject).length).toBe(0);
    });

    it("should handle containers with only factories", () => {
      class FactoryContainer extends DeclarativeContainer {
        config = new Factory(DatabaseConfig, "localhost", 5432, "db");
      }

      const Inject = createInject({ containerClass: FactoryContainer });

      expect(Inject.config).toBeDefined();
      expect(typeof Inject.config).toBe("function");
    });

    it("should handle containers with only singletons", () => {
      class SingletonContainer extends DeclarativeContainer {
        logger = new Singleton(Logger);
      }

      const Inject = createInject({ containerClass: SingletonContainer });

      expect(Inject.logger).toBeDefined();
      expect(typeof Inject.logger).toBe("function");
    });
  });

  describe("type safety", () => {
    it("should maintain type information for injectable markers", () => {
      const Inject = createInject({ containerClass: TestContainer });

      // This is a compile-time test - if it compiles, the types are correct
      class TestClass {
        method(
          @Inject.userService service: UserService = Provide(UserService),
          @Inject.database db: Database = Provide(Database),
          @Inject.logger log: Logger = Provide(Logger)
        ) {
          // Type assertions to verify correct typing
          const _service: UserService = service;
          const _db: Database = db;
          const _log: Logger = log;

          return { service: _service, db: _db, log: _log };
        }
      }

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(TestClass.prototype.method).toBeDefined();
    });
  });
});
