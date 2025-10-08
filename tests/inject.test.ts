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
      // Should only have wire and unwire methods, no provider markers
      expect(Object.keys(Inject).length).toBe(2);
      expect(Inject.wire).toBeDefined();
      expect(Inject.unwire).toBeDefined();
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

  describe("wire/unwire functionality", () => {
    describe("basic wire/unwire", () => {
      it("should have wire and unwire methods", () => {
        const Inject = createInject({ containerClass: TestContainer });

        expect(Inject.wire).toBeDefined();
        expect(typeof Inject.wire).toBe("function");
        expect(Inject.unwire).toBeDefined();
        expect(typeof Inject.unwire).toBe("function");
      });

      it("should auto-inject dependencies after wire()", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class TestClass {
          method(@Inject.userService service: UserService = Provide(UserService)) {
            return service.findUser(123);
          }
        }

        const container = new TestContainer();
        Inject.wire(container);

        const instance = new TestClass();
        const result = instance.method();

        expect(result).toContain("SELECT * FROM users WHERE id = 123");
        expect(result).toContain("testdb@localhost:5432");

        Inject.unwire(container);
      });

      it("should not auto-inject before wire() is called", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class TestClass {
          method(@Inject.userService service: UserService = Provide(UserService)) {
            return service?.findUser(123) ?? "no service";
          }
        }

        const instance = new TestClass();
        const result = instance.method();

        expect(result).toBe("no service");
      });

      it("should stop auto-injection after unwire()", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class TestClass {
          method(@Inject.userService service: UserService = Provide(UserService)) {
            return service?.findUser(123) ?? "no service";
          }
        }

        const container = new TestContainer();
        Inject.wire(container);

        const instance = new TestClass();
        const resultWired = instance.method();
        expect(resultWired).toContain("SELECT * FROM users WHERE id = 123");

        Inject.unwire(container);
        const resultUnwired = instance.method();
        expect(resultUnwired).toBe("no service");
      });
    });

    describe("multiple parameters", () => {
      it("should inject multiple parameters", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class TestClass {
          method(
            @Inject.userService service: UserService = Provide(UserService),
            @Inject.logger log: Logger = Provide(Logger)
          ) {
            return {
              user: service.findUser(456),
              logMsg: log.log("test"),
            };
          }
        }

        const container = new TestContainer();
        Inject.wire(container);

        const instance = new TestClass();
        const result = instance.method();

        expect(result.user).toContain("SELECT * FROM users WHERE id = 456");
        expect(result.logMsg).toBe("[LOG] test");

        Inject.unwire(container);
      });

      it("should inject only undefined parameters", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class TestClass {
          method(
            @Inject.userService service: UserService = Provide(UserService),
            @Inject.logger log: Logger = Provide(Logger)
          ) {
            return {
              serviceName: service.constructor.name,
              logMsg: log.log("test"),
            };
          }
        }

        const container = new TestContainer();
        Inject.wire(container);

        const instance = new TestClass();
        const customLogger = new Logger();

        const result = instance.method(undefined, customLogger);

        expect(result.serviceName).toBe("UserService");
        expect(result.logMsg).toBe("[LOG] test");

        Inject.unwire(container);
      });

      it("should respect manually provided parameters", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class ManualService extends UserService {
          findUser(id: number): string {
            return `Manual: ${super.findUser(id)}`;
          }
        }

        class TestClass {
          method(@Inject.userService service: UserService = Provide(UserService)) {
            return service.findUser(789);
          }
        }

        const container = new TestContainer();
        Inject.wire(container);

        const instance = new TestClass();

        const manualConfig = new DatabaseConfig("manual", 9999, "manualdb");
        const manualDb = new Database(manualConfig);
        const manualService = new ManualService(manualDb);

        const result = instance.method(manualService);

        expect(result).toContain("Manual:");
        expect(result).toContain("manualdb@manual:9999");

        Inject.unwire(container);
      });
    });

    describe("multiple containers", () => {
      it("should use the first wired container", () => {
        class Container1 extends DeclarativeContainer {
          dbConfig = new Factory(DatabaseConfig, "host1", 1111, "db1");
          database = new Singleton(Database, this.dbConfig);
          userService = new Singleton(UserService, this.database);
        }

        class Container2 extends DeclarativeContainer {
          dbConfig = new Factory(DatabaseConfig, "host2", 2222, "db2");
          database = new Singleton(Database, this.dbConfig);
          userService = new Singleton(UserService, this.database);
        }

        const Inject = createInject({ containerClass: Container1 });

        class TestClass {
          method(@Inject.userService service: UserService = Provide(UserService)) {
            return service.findUser(100);
          }
        }

        const container1 = new Container1();
        const container2 = new Container2();

        Inject.wire(container1);
        Inject.wire(container2);

        const instance = new TestClass();
        const result = instance.method();

        // Should use container1 (first wired)
        expect(result).toContain("db1@host1:1111");

        Inject.unwire(container1);
        Inject.unwire(container2);
      });

      it("should rewire with a different container", () => {
        class AppContainer extends DeclarativeContainer {
          dbConfig = new Factory(DatabaseConfig, "original", 3333, "originaldb");
          database = new Singleton(Database, this.dbConfig);
          userService = new Singleton(UserService, this.database);
        }

        const Inject = createInject({ containerClass: AppContainer });

        class TestClass {
          method(@Inject.userService service: UserService = Provide(UserService)) {
            return service.findUser(200);
          }
        }

        const container1 = new AppContainer();
        const container2 = new AppContainer();

        // Wire with container1
        Inject.wire(container1);

        const instance = new TestClass();
        const result1 = instance.method();
        expect(result1).toContain("originaldb@original:3333");

        // Unwire container1 and wire container2
        Inject.unwire(container1);
        Inject.wire(container2);

        const result2 = instance.method();
        expect(result2).toContain("originaldb@original:3333");

        Inject.unwire(container2);
      });
    });

    describe("singleton behavior with wire/unwire", () => {
      it("should inject singletons from the same container instance", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class TestClass {
          method(@Inject.database db: Database = Provide(Database)) {
            return db;
          }
        }

        const container = new TestContainer();
        Inject.wire(container);

        const instance = new TestClass();
        const db1 = instance.method();
        const db2 = instance.method();

        // Should be the same singleton instance
        expect(db1).toBe(db2);

        Inject.unwire(container);
      });

      it("should inject different singleton instances from different containers", () => {
        class AppContainer extends DeclarativeContainer {
          dbConfig = new Factory(DatabaseConfig, "localhost", 5432, "testdb");
          database = new Singleton(Database, this.dbConfig);
        }

        const Inject = createInject({ containerClass: AppContainer });

        class TestClass {
          method(@Inject.database db: Database = Provide(Database)) {
            return db;
          }
        }

        const container1 = new AppContainer();
        Inject.wire(container1);

        const instance = new TestClass();
        const db1 = instance.method();

        Inject.unwire(container1);

        const container2 = new AppContainer();
        Inject.wire(container2);

        const db2 = instance.method();

        // Should be different instances from different containers
        expect(db1).not.toBe(db2);

        Inject.unwire(container2);
      });
    });

    describe("method wrapper behavior", () => {
      it("should wrap methods only once", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class TestClass {
          method(@Inject.logger log: Logger = Provide(Logger)) {
            return log;
          }
        }

        const container1 = new TestContainer();
        const container2 = new TestContainer();

        // eslint-disable-next-line @typescript-eslint/unbound-method
        const originalMethod = TestClass.prototype.method;

        Inject.wire(container1);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const wrappedMethod = TestClass.prototype.method;

        Inject.wire(container2);
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const stillWrappedMethod = TestClass.prototype.method;

        // Method should be wrapped once and stay the same
        expect(originalMethod).not.toBe(wrappedMethod);
        expect(wrappedMethod).toBe(stillWrappedMethod);

        Inject.unwire(container1);
        Inject.unwire(container2);
      });

      it("should preserve this context when calling wrapped methods", () => {
        const Inject = createInject({ containerClass: TestContainer });

        class TestClass {
          constructor(public name: string) {}

          method(@Inject.logger log: Logger = Provide(Logger)) {
            return `${this.name}: ${log.log("message")}`;
          }
        }

        const container = new TestContainer();
        Inject.wire(container);

        const instance1 = new TestClass("instance1");
        const instance2 = new TestClass("instance2");

        expect(instance1.method()).toBe("instance1: [LOG] message");
        expect(instance2.method()).toBe("instance2: [LOG] message");

        Inject.unwire(container);
      });
    });

    describe("override and reset with wire", () => {
      it("should inject overridden providers", () => {
        class AppContainer extends DeclarativeContainer {
          dbConfig = new Factory(DatabaseConfig, "original", 5432, "originaldb");
          database = new Singleton(Database, this.dbConfig);
          userService = new Singleton(UserService, this.database);
        }

        const Inject = createInject({ containerClass: AppContainer });

        class TestClass {
          method(@Inject.userService service: UserService = Provide(UserService)) {
            return service.findUser(999);
          }
        }

        const container = new AppContainer();

        // Override the config
        container.dbConfig.override(new Factory(DatabaseConfig, "overridden", 9999, "overriddendb"));
        container.database.resetInstance();
        container.userService.resetInstance();

        Inject.wire(container);

        const instance = new TestClass();
        const result = instance.method();

        expect(result).toContain("overriddendb@overridden:9999");

        Inject.unwire(container);
      });
    });
  });
});
