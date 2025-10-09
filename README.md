# TypeScript Dependency Injector

<img src="https://raw.githubusercontent.com/wiki/ets-labs/python-dependency-injector/img/logo.svg" alt="Dependency Injector Logo" width="200"/>

TypeScript Dependency Injector (TDI) is a type-safe dependency injection framework for TypeScript with declarative container support and decorator-based injection.

Inspired by [Python Dependency Injector](https://github.com/ets-labs/python-dependency-injector), this framework brings similar powerful dependency injection patterns to TypeScript.

> **⚠️ Early Development**: This framework is currently in early development stage. The API may change, and more providers and features will be added in future releases.

## Installation

```bash
npm install @rmk-labs/typescript-dependency-injector
```

## Features

- **Declarative Containers**: Define DI containers using class properties
- **Provider Types**: `Factory` (new instance each time), `Singleton` (shared instance), `Delegate` (inject provider itself)
- **Type Safety**: Full TypeScript type inference and compile-time checks
- **Decorator-Based Injection**: Optional parameter decorator support with `@Inject`
- **Provider Overriding**: Replace providers at runtime for testing or configuration
- **Well Tested**: Fully covered with comprehensive unit tests
- **Zero Dependencies**: Lightweight with no external dependencies

## Quick Start

```typescript
import {
  DeclarativeContainer,
  Factory,
  Singleton,
  createInject,
  Provide,
} from "@rmk-labs/typescript-dependency-injector";

// Define your classes
class DatabaseConfig {
  constructor(public host: string, public port: number) {}
}

class Database {
  constructor(public config: DatabaseConfig) {}
  query(sql: string): string {
    return `Executing: ${sql}`;
  }
}

class UserService {
  constructor(private db: Database) {}

  getUser(id: number): string {
    return this.db.query(`SELECT * FROM users WHERE id = ${id}`);
  }
}

// Create a container
class AppContainer extends DeclarativeContainer {
  config = new Factory(DatabaseConfig, "localhost", 5432);
  database = new Singleton(Database, this.config);
  userService = new Singleton(UserService, this.database);
}

// Create injection decorators
const Inject = createInject({ containerClass: AppContainer });

// Use decorator-based injection
class UserController {
  getUser(
    id: number,
    @Inject.userService service: UserService = Provide(UserService),
  ): string {
    return service.getUser(id);
  }
}

// Wire container and use
const container = new AppContainer();
Inject.wire(container);

const controller = new UserController();
controller.getUser(123); // Dependencies injected automatically
```

## Core Concepts

### Providers

Providers are the building blocks that define how dependencies are created:

#### Factory Provider
Creates a new instance every time `provide()` is called:

```typescript
class MyContainer extends DeclarativeContainer {
  config = new Factory(DatabaseConfig, "localhost", 5432);
}

const container = new MyContainer();
const config1 = container.config.provide(); // new instance
const config2 = container.config.provide(); // different instance
```

#### Singleton Provider
Returns the same instance on every `provide()` call:

```typescript
class MyContainer extends DeclarativeContainer {
  database = new Singleton(Database, this.config);
}

const container = new MyContainer();
const db1 = container.database.provide(); // creates instance
const db2 = container.database.provide(); // returns same instance
```

#### Delegate Provider
Injects the provider itself rather than the provided value. Useful when you need to create instances on demand:

```typescript
import { Provider } from "@rmk-labs/typescript-dependency-injector";

class ConnectionPool {
  private connections: Database[] = [];

  constructor(private databaseFactory: Provider<Database>) {}

  getConnection(): Database {
    // Create a new database connection on demand
    return this.databaseFactory.provide();
  }
}

class MyContainer extends DeclarativeContainer {
  config = new Factory(DatabaseConfig, "localhost", 5432);
  databaseFactory = new Factory(Database, this.config);
  connectionPool = new Singleton(ConnectionPool, this.databaseFactory.provider); // .provider returns Delegate(this.databaseFactory)
}

const container = new MyContainer();
const pool = container.connectionPool.provide();
const conn1 = pool.getConnection(); // Creates new Database instance
const conn2 = pool.getConnection(); // Creates another new Database instance
```

### Dependency Injection Between Providers

Pass providers as constructor arguments to automatically inject dependencies:

```typescript
class MyContainer extends DeclarativeContainer {
  config = new Factory(DatabaseConfig, "localhost", 5432);
  cache = new Factory(CacheConfig, 3600, 1000);
  database = new Singleton(Database, this.config);
  service = new Singleton(UserService, this.database, this.cache);
}
```

### Decorator-Based Injection

Use parameter decorators for more flexible dependency injection:

```typescript
import { createInject, Provide } from "@rmk-labs/typescript-dependency-injector";

class MyContainer extends DeclarativeContainer {
  database = new Singleton(Database, this.config);
  logger = new Singleton(Logger);
}

// Create injection markers
const Inject = createInject({ containerClass: MyContainer });

class UserController {
  // Method parameter injection
  getUser(
    id: number,
    @Inject.database db: Database = Provide(Database),
    @Inject.logger log: Logger = Provide(Logger),
  ): string {
    log.log(`Fetching user ${id}`);
    return db.query(`SELECT * FROM users WHERE id = ${id}`);
  }
}

// Wire container to enable injection
const container = new MyContainer();
Inject.wire(container);

const controller = new UserController();
controller.getUser(123); // Dependencies automatically injected
```

#### Constructor Injection

The `@Inject.Injectable` decorator is required for constructor injections:

```typescript
@Inject.Injectable
class UserService {
  constructor(
    @Inject.database private db: Database = Provide(Database),
    @Inject.logger private log: Logger = Provide(Logger),
  ) {}

  findUser(id: number): string {
    this.log.log(`Finding user ${id}`);
    return this.db.query(`SELECT * FROM users WHERE id = ${id}`);
  }
}

const container = new MyContainer();
Inject.wire(container);

const service = new UserService(); // Dependencies auto-injected
```

## Advanced Features

### Provider Overriding

Override providers for testing or different configurations:

```typescript
const container = new MyContainer();

// Original behavior
const db1 = container.database.provide();

// Override with a mock
const mockDatabase = new Factory(() => new MockDatabase());
container.database.override(mockDatabase);
const db2 = container.database.provide(); // Returns mock

// Reset overrides
container.resetProviderOverrides();
const db3 = container.database.provide(); // Back to original
```

### Singleton Reset

Reset singleton instances to get fresh instances:

```typescript
const container = new MyContainer();

const db1 = container.database.provide();
const db2 = container.database.provide();
console.log(db1 === db2); // true (same instance)

container.resetSingletonInstances();

const db3 = container.database.provide();
console.log(db1 === db3); // false (new instance)
```

### Wire/Unwire

Control when injection is active:

```typescript
const container = new MyContainer();
const Inject = createInject({ containerClass: MyContainer });

Inject.wire(container); // Enable injection
// ... use injected dependencies
Inject.unwire(container); // Disable injection
```

## API Reference

### Classes

- **`DeclarativeContainer`**: Base class for defining DI containers
- **`Factory<T>`**: Provider that creates new instances
- **`Singleton<T>`**: Provider that maintains a single instance
- **`Delegate<T>`**: Provider that returns another provider
- **`BaseProvider<T>`**: Abstract base class for custom providers

### Functions

- **`createInject({ containerClass })`**: Creates injection decorators for a container
- **`Provide(Type)`**: Syntax sugar for default parameter values. Only needed when you want to fix typing or call methods with injections explicitly. Returns `undefined` at runtime - the actual injection is done by the decorator

### Container Methods

- **`container.resetProviderOverrides()`**: Resets all provider overrides
- **`container.resetSingletonInstances()`**: Resets all singleton instances

### Inject API Methods

- **`Inject.wire(container)`**: Enable dependency injection
- **`Inject.unwire(container)`**: Disable dependency injection
- **`Inject.Injectable`**: Class decorator for constructor injection
- **`@Inject.propertyName`**: Parameter decorator for each container provider

## TypeScript Configuration

Enable experimental decorators in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false
  }
}
```

## Contributing

Found a bug or have a feature request? Please [open an issue](https://github.com/RMK-Labs/typescript-dependency-injector/issues) on GitHub.

## Support

If you find this project helpful, consider [sponsoring the development](https://github.com/sponsors/rmk135) to help ensure continued maintenance and new features.

## License

BSD-3-Clause

## Repository

[https://github.com/rmk-labs/typescript-dependency-injector](https://github.com/rmk-labs/typescript-dependency-injector)
