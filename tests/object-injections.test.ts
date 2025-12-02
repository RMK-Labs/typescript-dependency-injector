import { DeclarativeContainer, Factory, Singleton, ObjectInjections } from "../src";
import { isObjectInjections } from "../src/object-injections";

describe("ObjectInjections", () => {
  // Simple test classes
  class Logger {
    log(message: string): string {
      return `[Logger] ${message}`;
    }
  }

  class Database {
    constructor(public connectionString: string) {}
    query(sql: string): string {
      return `[DB: ${this.connectionString}] ${sql}`;
    }
  }

  describe("ObjectInjections class", () => {
    it("should create an ObjectInjections instance with defaults", () => {
      const objectInjections = new ObjectInjections({ foo: "bar", num: 42 });
      expect(objectInjections.defaults).toEqual({ foo: "bar", num: 42 });
    });

    it("should be identifiable with isObjectInjections", () => {
      const objectInjections = new ObjectInjections({ foo: "bar" });
      expect(isObjectInjections(objectInjections)).toBe(true);
      expect(isObjectInjections({})).toBe(false);
      expect(isObjectInjections(null)).toBe(false);
      expect(isObjectInjections(undefined)).toBe(false);
      expect(isObjectInjections("string")).toBe(false);
    });
  });

  describe("Factory with ObjectInjections", () => {
    interface ServiceDeps {
      logger: Logger;
      database: Database;
      requestId: string;
    }

    class Service {
      constructor(public deps: ServiceDeps) {}

      execute(): string {
        const log = this.deps.logger.log(`Processing request ${this.deps.requestId}`);
        const result = this.deps.database.query("SELECT * FROM users");
        return `${log} | ${result}`;
      }
    }

    class TestContainer extends DeclarativeContainer {
      logger = new Singleton(Logger);
      database = new Singleton(Database, "localhost:5432");
      service = new Factory(Service, new ObjectInjections({
        logger: this.logger,
        database: this.database,
      }));
    }

    it("should merge context with defaults when calling provide", () => {
      const container = new TestContainer();
      const service = container.service.provide({ requestId: "req-123" });

      expect(service.deps.requestId).toBe("req-123");
      expect(service.deps.logger).toBeInstanceOf(Logger);
      expect(service.deps.database).toBeInstanceOf(Database);
      expect(service.deps.database.connectionString).toBe("localhost:5432");
    });

    it("should execute service methods correctly with merged context", () => {
      const container = new TestContainer();
      const service = container.service.provide({ requestId: "req-456" });

      const result = service.execute();
      expect(result).toContain("req-456");
      expect(result).toContain("[Logger]");
      expect(result).toContain("[DB: localhost:5432]");
    });

    it("should allow context to override default providers", () => {
      const container = new TestContainer();
      const customLogger = new Logger();
      customLogger.log = (message: string) => `[CUSTOM] ${message}`;

      const service = container.service.provide({
        requestId: "req-789",
        logger: customLogger,
      });

      const result = service.execute();
      expect(result).toContain("[CUSTOM]");
      expect(result).toContain("req-789");
    });

    it("should not call default providers for overridden context values", () => {
      let loggerCalls = 0;

      class SpyContainer extends DeclarativeContainer {
        logger = new Factory(() => {
          loggerCalls++;
          return new Logger();
        });
        database = new Singleton(Database, "localhost:5432");
        service = new Factory(Service, new ObjectInjections({
          logger: this.logger,
          database: this.database,
        }));
      }

      const container = new SpyContainer();

      // Provide logger in context - should not call the factory
      container.service.provide({
        requestId: "req-123",
        logger: new Logger(),
      });

      expect(loggerCalls).toBe(0);

      // Don't provide logger in context - should call the factory
      container.service.provide({ requestId: "req-456" });

      expect(loggerCalls).toBe(1);
    });

    it("should create new instances with different contexts for Factory", () => {
      const container = new TestContainer();

      const service1 = container.service.provide({ requestId: "req-1" });
      const service2 = container.service.provide({ requestId: "req-2" });

      expect(service1).not.toBe(service2);
      expect(service1.deps.requestId).toBe("req-1");
      expect(service2.deps.requestId).toBe("req-2");
    });

    it("should resolve providers in defaults correctly", () => {
      const container = new TestContainer();
      const service = container.service.provide({ requestId: "test" });

      // Logger and Database should be the same singletons
      const logger1 = container.logger.provide();
      const database1 = container.database.provide();

      expect(service.deps.logger).toBe(logger1);
      expect(service.deps.database).toBe(database1);
    });

    it("should work with empty context object", () => {
      class SimpleContainer extends DeclarativeContainer {
        logger = new Singleton(Logger);
        service = new Factory(Service, new ObjectInjections({
          logger: this.logger,
          database: new Database("test"),
          requestId: "default-request",
        }));
      }

      const container = new SimpleContainer();
      const service = container.service.provide({});

      expect(service.deps.requestId).toBe("default-request");
      expect(service.deps.logger).toBeInstanceOf(Logger);
    });

    it("should work without providing any context", () => {
      class SimpleContainer extends DeclarativeContainer {
        logger = new Singleton(Logger);
        service = new Factory(Service, new ObjectInjections({
          logger: this.logger,
          database: new Database("test"),
          requestId: "default-request",
        }));
      }

      const container = new SimpleContainer();
      const service = container.service.provide();

      expect(service.deps.requestId).toBe("default-request");
      expect(service.deps.logger).toBeInstanceOf(Logger);
    });
  });

  describe("Multiple ObjectInjections arguments", () => {
    interface Config {
      timeout: number;
    }

    class ServiceWithMultipleArgs {
      constructor(
        public config: Config,
        public logger: Logger
      ) {}
    }

    class TestContainer extends DeclarativeContainer {
      logger = new Singleton(Logger);
      service = new Factory(
        ServiceWithMultipleArgs,
        new ObjectInjections({ timeout: 5000 }),
        this.logger
      );
    }

    it("should handle multiple arguments with ObjectInjections in the mix", () => {
      const container = new TestContainer();
      const service = container.service.provide({ timeout: 3000 });

      expect(service.config.timeout).toBe(3000);
      expect(service.logger).toBeInstanceOf(Logger);
    });

    it("should resolve non-ObjectInjections arguments normally", () => {
      const container = new TestContainer();
      const service = container.service.provide({});

      expect(service.config.timeout).toBe(5000);
      expect(service.logger).toBe(container.logger.provide());
    });
  });

  describe("ObjectInjections with Singleton", () => {
    interface ServiceDeps {
      logger: Logger;
      instanceId: string;
    }

    class SingletonService {
      constructor(public deps: ServiceDeps) {}
    }

    class TestContainer extends DeclarativeContainer {
      logger = new Singleton(Logger);
      service = new Singleton(SingletonService, new ObjectInjections({
        logger: this.logger,
      }));
    }

    it("should create singleton on first call and reuse it", () => {
      const container = new TestContainer();

      const service1 = container.service.provide({ instanceId: "first" });
      const service2 = container.service.provide({ instanceId: "second" });

      // Should be the same instance
      expect(service1).toBe(service2);
      // Should use the context from the first call
      expect(service1.deps.instanceId).toBe("first");
      expect(service2.deps.instanceId).toBe("first");
    });

    it("should reset singleton and create new instance with new context", () => {
      const container = new TestContainer();

      const service1 = container.service.provide({ instanceId: "first" });

      // Reset the singleton
      container.service.resetInstance();

      const service2 = container.service.provide({ instanceId: "second" });

      expect(service1).not.toBe(service2);
      expect(service1.deps.instanceId).toBe("first");
      expect(service2.deps.instanceId).toBe("second");
    });
  });

  describe("Edge cases", () => {
    it("should handle ObjectInjections with empty defaults", () => {
      class EmptyService {
        constructor(public deps: Record<string, any>) {}
      }

      class TestContainer extends DeclarativeContainer {
        service = new Factory(EmptyService, new ObjectInjections({}));
      }

      const container = new TestContainer();
      const service = container.service.provide({ foo: "bar" });

      expect(service.deps).toEqual({ foo: "bar" });
    });

    it("should handle nested objects in context", () => {
      interface ServiceDeps {
        config: {
          nested: {
            value: number;
          };
        };
      }

      class NestedService {
        constructor(public deps: ServiceDeps) {}
      }

      class TestContainer extends DeclarativeContainer {
        service = new Factory(NestedService, new ObjectInjections({}));
      }

      const container = new TestContainer();
      const service = container.service.provide({
        config: { nested: { value: 42 } },
      });

      expect(service.deps.config.nested.value).toBe(42);
    });

    it("should preserve reference types in context", () => {
      const sharedArray = [1, 2, 3];

      interface ServiceDeps {
        data: number[];
      }

      class RefService {
        constructor(public deps: ServiceDeps) {}
      }

      class TestContainer extends DeclarativeContainer {
        service = new Factory(RefService, new ObjectInjections({}));
      }

      const container = new TestContainer();
      const service = container.service.provide({ data: sharedArray });

      expect(service.deps.data).toBe(sharedArray);
      service.deps.data.push(4);
      expect(sharedArray).toEqual([1, 2, 3, 4]);
    });
  });

  describe("Factory without ObjectInjections (backward compatibility)", () => {
    class SimpleService {
      constructor(
        public logger: Logger,
        public message: string
      ) {}
    }

    class TestContainer extends DeclarativeContainer {
      logger = new Singleton(Logger);
      service = new Factory(SimpleService, this.logger, "hello");
    }

    it("should work normally without ObjectInjections", () => {
      const container = new TestContainer();
      const service = container.service.provide();

      expect(service.logger).toBeInstanceOf(Logger);
      expect(service.message).toBe("hello");
    });

    it("should pass provide args before injected args when not using ObjectInjections", () => {
      class ServiceWithArgs {
        constructor(
          public arg1: string,
          public logger: Logger
        ) {}
      }

      class TestContainer extends DeclarativeContainer {
        logger = new Singleton(Logger);
        service = new Factory(ServiceWithArgs, this.logger);
      }

      const container = new TestContainer();
      const service = container.service.provide("test-arg");

      expect(service.arg1).toBe("test-arg");
      expect(service.logger).toBeInstanceOf(Logger);
    });
  });
});
