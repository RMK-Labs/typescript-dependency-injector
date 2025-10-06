import { DeclarativeContainer, Factory, Singleton, initDeclarativeContainer } from "../src";

// Test domain classes
class DatabaseConfig {
  constructor(
    public host: string,
    public port: number,
    public database: string
  ) {}
}

class CacheConfig {
  constructor(
    public ttl: number,
    public maxSize: number
  ) {}
}

class Database {
  constructor(public config: DatabaseConfig) {}

  query(sql: string): string {
    return `Executing: ${sql}`;
  }
}

describe("DeclarativeContainer", () => {
  describe("initDeclarativeContainer", () => {
    it("should create a container with static provider access", () => {
      const Container = initDeclarativeContainer(class extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        cacheConfig = new Factory(CacheConfig, 3600, 1000);
        database = new Singleton(Database, this.databaseConfig);
      });

      // Test static access
      expect(Container.databaseConfig).toBeDefined();
      expect(Container.cacheConfig).toBeDefined();
      expect(Container.database).toBeDefined();

      // Test Factory provider
      const config1 = Container.databaseConfig.provide();
      const config2 = Container.databaseConfig.provide();
      expect(config1).toBeInstanceOf(DatabaseConfig);
      expect(config2).toBeInstanceOf(DatabaseConfig);
      expect(config1).not.toBe(config2); // Factory creates new instances

      // Test Singleton provider
      const db1 = Container.database.provide();
      const db2 = Container.database.provide();
      expect(db1).toBeInstanceOf(Database);
      expect(db2).toBeInstanceOf(Database);
      expect(db1).toBe(db2); // Singleton returns same instance
    });

    it("should allow instance access to providers", () => {
      const Container = initDeclarativeContainer(class extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.databaseConfig);
      });

      // Test instance access
      const container = new Container();
      expect(container.databaseConfig).toBeDefined();
      expect(container.database).toBeDefined();

      const db1 = container.database.provide();
      const db2 = container.database.provide();
      expect(db1).toBe(db2); // Same singleton instance from same container instance
    });

    it("should maintain separate singleton instances per container instance", () => {
      const Container = initDeclarativeContainer(class extends DeclarativeContainer {
        database = new Singleton(Database, new Factory(DatabaseConfig, "localhost", 5432, "myapp"));
      });

      const container1 = new Container();
      const container2 = new Container();

      const db1 = container1.database.provide();
      const db2 = container2.database.provide();

      expect(db1).toBeInstanceOf(Database);
      expect(db2).toBeInstanceOf(Database);
      expect(db1).not.toBe(db2); // Different container instances have different singletons
    });

    it("should share singleton across static and instance access", () => {
      const Container = initDeclarativeContainer(class extends DeclarativeContainer {
        database = new Singleton(Database, new Factory(DatabaseConfig, "localhost", 5432, "myapp"));
      });

      const container = new Container();

      // Static access gets the provider from the internal instance
      const dbFromStatic1 = Container.database.provide();
      const dbFromStatic2 = Container.database.provide();

      // Instance access gets the provider from that instance
      const dbFromInstance1 = container.database.provide();
      const dbFromInstance2 = container.database.provide();

      // Each singleton instance maintains its own state
      expect(dbFromStatic1).toBe(dbFromStatic2);
      expect(dbFromInstance1).toBe(dbFromInstance2);
      // But static and instance are different singleton instances
      expect(dbFromStatic1).not.toBe(dbFromInstance1);
    });

    it("should support dependency injection between providers", () => {
      const Container = initDeclarativeContainer(class extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.databaseConfig);
      });

      const db = Container.database.provide();
      expect(db.config).toBeInstanceOf(DatabaseConfig);
      expect(db.config.host).toBe("localhost");
      expect(db.config.port).toBe(5432);
      expect(db.config.database).toBe("myapp");
    });

    it("should handle complex provider hierarchies", () => {
      class Service {
        constructor(public db: Database, public cache: CacheConfig) {}
      }

      const Container = initDeclarativeContainer(class extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        cacheConfig = new Factory(CacheConfig, 3600, 1000);
        database = new Singleton(Database, this.databaseConfig);
        service = new Singleton(Service, this.database, this.cacheConfig);
      });

      const service = Container.service.provide();
      expect(service).toBeInstanceOf(Service);
      expect(service.db).toBeInstanceOf(Database);
      expect(service.cache).toBeInstanceOf(CacheConfig);

      // Verify singleton behavior
      const service2 = Container.service.provide();
      expect(service).toBe(service2);
      expect(service.db).toBe(service2.db); // Same database singleton
    });

    it("should provide type-safe access to providers", () => {
      const Container = initDeclarativeContainer(class extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.databaseConfig);
      });

      // TypeScript should infer correct types
      const config: DatabaseConfig = Container.databaseConfig.provide();
      const db: Database = Container.database.provide();

      expect(config).toBeInstanceOf(DatabaseConfig);
      expect(db).toBeInstanceOf(Database);
    });

    it("should work with empty containers", () => {
      const Container = initDeclarativeContainer(class extends DeclarativeContainer {});

      const container = new Container();
      expect(container).toBeInstanceOf(DeclarativeContainer);
    });

    it("should not override existing static properties", () => {
      class TestContainer extends DeclarativeContainer {
        static existingStatic = "should-not-change";
        database = new Singleton(Database, new Factory(DatabaseConfig, "localhost", 5432, "myapp"));
      }

      const Container = initDeclarativeContainer(TestContainer);

      expect(Container.existingStatic).toBe("should-not-change");
      expect(Container.database).toBeDefined();
    });
  });
});
