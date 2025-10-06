import { DeclarativeContainer, Factory, Singleton } from "../src";

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
  it("should create a container with instance provider access", () => {
    class Container extends DeclarativeContainer {
      databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
      cacheConfig = new Factory(CacheConfig, 3600, 1000);
      database = new Singleton(Database, this.databaseConfig);
    }

    const container = new Container();

    // Test instance access
    expect(container.databaseConfig).toBeDefined();
    expect(container.cacheConfig).toBeDefined();
    expect(container.database).toBeDefined();

    // Test Factory provider
    const config1 = container.databaseConfig.provide();
    const config2 = container.databaseConfig.provide();
    expect(config1).toBeInstanceOf(DatabaseConfig);
    expect(config2).toBeInstanceOf(DatabaseConfig);
    expect(config1).not.toBe(config2); // Factory creates new instances

    // Test Singleton provider
    const db1 = container.database.provide();
    const db2 = container.database.provide();
    expect(db1).toBeInstanceOf(Database);
    expect(db2).toBeInstanceOf(Database);
    expect(db1).toBe(db2); // Singleton returns same instance
  });

  it("should allow instance access to providers", () => {
    class Container extends DeclarativeContainer {
      databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
      database = new Singleton(Database, this.databaseConfig);
    }

    // Test instance access
    const container = new Container();
    expect(container.databaseConfig).toBeDefined();
    expect(container.database).toBeDefined();

    const db1 = container.database.provide();
    const db2 = container.database.provide();
    expect(db1).toBe(db2); // Same singleton instance from same container instance
  });

  it("should maintain separate singleton instances per container instance", () => {
    class Container extends DeclarativeContainer {
      database = new Singleton(Database, new Factory(DatabaseConfig, "localhost", 5432, "myapp"));
    }

    const container1 = new Container();
    const container2 = new Container();

    const db1 = container1.database.provide();
    const db2 = container2.database.provide();

    expect(db1).toBeInstanceOf(Database);
    expect(db2).toBeInstanceOf(Database);
    expect(db1).not.toBe(db2); // Different container instances have different singletons
  });

  it("should support dependency injection between providers", () => {
    class Container extends DeclarativeContainer {
      databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
      database = new Singleton(Database, this.databaseConfig);
    }

    const container = new Container();
    const db = container.database.provide();
    expect(db.config).toBeInstanceOf(DatabaseConfig);
    expect(db.config.host).toBe("localhost");
    expect(db.config.port).toBe(5432);
    expect(db.config.database).toBe("myapp");
  });

  it("should handle complex provider hierarchies", () => {
    class Service {
      constructor(public db: Database, public cache: CacheConfig) {}
    }

    class Container extends DeclarativeContainer {
      databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
      cacheConfig = new Factory(CacheConfig, 3600, 1000);
      database = new Singleton(Database, this.databaseConfig);
      service = new Singleton(Service, this.database, this.cacheConfig);
    }

    const container = new Container();
    const service = container.service.provide();
    expect(service).toBeInstanceOf(Service);
    expect(service.db).toBeInstanceOf(Database);
    expect(service.cache).toBeInstanceOf(CacheConfig);

    // Verify singleton behavior
    const service2 = container.service.provide();
    expect(service).toBe(service2);
    expect(service.db).toBe(service2.db); // Same database singleton
  });

  it("should provide type-safe access to providers", () => {
    class Container extends DeclarativeContainer {
      databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
      database = new Singleton(Database, this.databaseConfig);
    }

    const container = new Container();

    // TypeScript should infer correct types
    const config: DatabaseConfig = container.databaseConfig.provide();
    const db: Database = container.database.provide();

    expect(config).toBeInstanceOf(DatabaseConfig);
    expect(db).toBeInstanceOf(Database);
  });

  it("should work with empty containers", () => {
    class Container extends DeclarativeContainer {}

    const container = new Container();
    expect(container).toBeInstanceOf(DeclarativeContainer);
  });

  it("should support static properties on container classes", () => {
    class Container extends DeclarativeContainer {
      static existingStatic = "should-not-change";
      database = new Singleton(Database, new Factory(DatabaseConfig, "localhost", 5432, "myapp"));
    }

    const container = new Container();
    expect(Container.existingStatic).toBe("should-not-change");
    expect(container.database).toBeDefined();
  });
});
