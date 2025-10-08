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

  describe("resetSingletonInstances", () => {
    it("should reset all singleton instances in the container", () => {
      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.databaseConfig);
      }

      const container = new Container();

      // Get initial singleton instance
      const db1 = container.database.provide();
      expect(db1).toBeInstanceOf(Database);

      // Get same instance (singleton behavior)
      const db2 = container.database.provide();
      expect(db1).toBe(db2);

      // Reset singleton instances
      container.resetSingletonInstances();

      // Get new instance after reset
      const db3 = container.database.provide();
      expect(db3).toBeInstanceOf(Database);
      expect(db3).not.toBe(db1); // Should be a different instance
    });

    it("should reset multiple singleton instances", () => {
      class Service {
        constructor(public db: Database, public cache: CacheConfig) {}
      }

      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        cacheConfig = new Factory(CacheConfig, 3600, 1000);
        database = new Singleton(Database, this.databaseConfig);
        cache = new Singleton(CacheConfig, 7200, 2000);
        service = new Singleton(Service, this.database, this.cache);
      }

      const container = new Container();

      // Get initial instances
      const db1 = container.database.provide();
      const cache1 = container.cache.provide();
      const service1 = container.service.provide();

      // Reset all singletons
      container.resetSingletonInstances();

      // Get new instances
      const db2 = container.database.provide();
      const cache2 = container.cache.provide();
      const service2 = container.service.provide();

      // All should be different instances
      expect(db2).not.toBe(db1);
      expect(cache2).not.toBe(cache1);
      expect(service2).not.toBe(service1);
    });

    it("should not affect Factory providers", () => {
      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.databaseConfig);
      }

      const container = new Container();

      // Get factory instances (always different)
      const config1 = container.databaseConfig.provide();
      const config2 = container.databaseConfig.provide();
      expect(config1).not.toBe(config2);

      // Reset should not affect factory behavior
      container.resetSingletonInstances();

      const config3 = container.databaseConfig.provide();
      expect(config3).not.toBe(config1);
      expect(config3).not.toBe(config2);
    });

    it("should work with empty containers", () => {
      class Container extends DeclarativeContainer {}

      const container = new Container();
      expect(() => container.resetSingletonInstances()).not.toThrow();
    });

    it("should work with containers that have no singletons", () => {
      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        cacheConfig = new Factory(CacheConfig, 3600, 1000);
      }

      const container = new Container();
      expect(() => container.resetSingletonInstances()).not.toThrow();
    });
  });

  describe("resetProviderOverrides", () => {
    it("should reset overrides on Factory providers", () => {
      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.databaseConfig);
      }

      const container = new Container();

      // Get original value
      const config1 = container.databaseConfig.provide();
      expect(config1.host).toBe("localhost");
      expect(config1.port).toBe(5432);

      // Override the factory
      container.databaseConfig.override(new Factory(DatabaseConfig, "overridden", 9999, "overriddendb"));
      const config2 = container.databaseConfig.provide();
      expect(config2.host).toBe("overridden");
      expect(config2.port).toBe(9999);

      // Reset overrides
      container.resetProviderOverrides();

      // Should return to original behavior
      const config3 = container.databaseConfig.provide();
      expect(config3.host).toBe("localhost");
      expect(config3.port).toBe(5432);
    });

    it("should reset overrides on Singleton providers", () => {
      class Container extends DeclarativeContainer {
        database = new Singleton(Database, new Factory(DatabaseConfig, "localhost", 5432, "myapp"));
      }

      const container = new Container();

      // Get original singleton
      const db1 = container.database.provide();
      expect(db1.config.host).toBe("localhost");

      // Override the singleton with a different factory
      container.database.override(new Singleton(Database, new Factory(DatabaseConfig, "overridden", 9999, "overriddendb")));

      // Reset the singleton instance to get the overridden value
      container.database.resetInstance();
      const db2 = container.database.provide();
      expect(db2.config.host).toBe("overridden");

      // Reset overrides
      container.resetProviderOverrides();
      container.database.resetInstance();

      // Should return to original behavior
      const db3 = container.database.provide();
      expect(db3.config.host).toBe("localhost");
      expect(db3.config.port).toBe(5432);
    });

    it("should reset multiple provider overrides", () => {
      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        cacheConfig = new Factory(CacheConfig, 3600, 1000);
      }

      const container = new Container();

      // Override both
      container.databaseConfig.override(new Factory(DatabaseConfig, "override1", 1111, "db1"));
      container.cacheConfig.override(new Factory(CacheConfig, 9999, 9999));

      const config1 = container.databaseConfig.provide();
      const cache1 = container.cacheConfig.provide();
      expect(config1.host).toBe("override1");
      expect(cache1.ttl).toBe(9999);

      // Reset all overrides
      container.resetProviderOverrides();

      const config2 = container.databaseConfig.provide();
      const cache2 = container.cacheConfig.provide();
      expect(config2.host).toBe("localhost");
      expect(cache2.ttl).toBe(3600);
    });

    it("should work with empty containers", () => {
      class Container extends DeclarativeContainer {}

      const container = new Container();
      expect(() => container.resetProviderOverrides()).not.toThrow();
    });

    it("should not affect providers that were never overridden", () => {
      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        cacheConfig = new Factory(CacheConfig, 3600, 1000);
      }

      const container = new Container();

      // Override only one provider
      container.databaseConfig.override(new Factory(DatabaseConfig, "overridden", 9999, "overriddendb"));

      // Reset all overrides
      container.resetProviderOverrides();

      // Non-overridden provider should still work
      const cache = container.cacheConfig.provide();
      expect(cache.ttl).toBe(3600);
      expect(cache.maxSize).toBe(1000);
    });
  });

  describe("combined resetSingletonInstances and resetProviderOverrides", () => {
    it("should work together to reset container state", () => {
      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.databaseConfig);
      }

      const container = new Container();

      // Get initial singleton
      const db1 = container.database.provide();
      expect(db1.config.host).toBe("localhost");

      // Override config
      container.databaseConfig.override(new Factory(DatabaseConfig, "overridden", 9999, "overriddendb"));

      // Reset singleton to get new config
      container.database.resetInstance();
      const db2 = container.database.provide();
      expect(db2.config.host).toBe("overridden");
      expect(db2).not.toBe(db1);

      // Reset overrides and singletons
      container.resetProviderOverrides();
      container.resetSingletonInstances();

      // Should be back to original state
      const db3 = container.database.provide();
      expect(db3.config.host).toBe("localhost");
      expect(db3.config.port).toBe(5432);
      expect(db3).not.toBe(db1);
      expect(db3).not.toBe(db2);
    });

    it("should reset complex dependency hierarchies", () => {
      class Service {
        constructor(public db: Database) {}
      }

      class Container extends DeclarativeContainer {
        databaseConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");
        database = new Singleton(Database, this.databaseConfig);
        service = new Singleton(Service, this.database);
      }

      const container = new Container();

      // Get initial state
      const service1 = container.service.provide();
      expect(service1.db.config.host).toBe("localhost");

      // Override and reset database
      container.databaseConfig.override(new Factory(DatabaseConfig, "overridden", 9999, "overriddendb"));
      container.database.resetInstance();
      container.service.resetInstance();

      const service2 = container.service.provide();
      expect(service2.db.config.host).toBe("overridden");

      // Full reset
      container.resetProviderOverrides();
      container.resetSingletonInstances();

      const service3 = container.service.provide();
      expect(service3.db.config.host).toBe("localhost");
      expect(service3).not.toBe(service1);
      expect(service3).not.toBe(service2);
    });
  });
});
