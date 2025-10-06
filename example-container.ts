// Example usage of DeclarativeContainer
import { DeclarativeContainer, Factory, Singleton, initDeclarativeContainer } from "./src";

// Domain classes
class DatabaseConfig {
  constructor(
    public host: string,
    public port: number,
    public database: string
  ) {}
}

class Database {
  constructor(public config: DatabaseConfig) {}

  query(sql: string): void {
    console.log(`[${this.config.database}@${this.config.host}:${this.config.port}] Executing: ${sql}`);
  }
}

class UserService {
  constructor(private db: Database) {}

  findUser(id: number): void {
    this.db.query(`SELECT * FROM users WHERE id = ${id}`);
  }
}

// Create a container with declarative syntax
const AppContainer = initDeclarativeContainer(class extends DeclarativeContainer {
  // Factory creates a new instance each time
  dbConfig = new Factory(DatabaseConfig, "localhost", 5432, "myapp");

  // Singleton creates one instance and reuses it
  // Pass this.dbConfig to inject the factory's result
  database = new Singleton(Database, this.dbConfig);

  // UserService depends on the Database singleton
  userService = new Singleton(UserService, this.database);
});

// Static access - convenient for top-level usage
const userService = AppContainer.userService.provide();
userService.findUser(123);

// Instance access - useful when you want separate instances
const container1 = new AppContainer();
const container2 = new AppContainer();

const service1 = container1.userService.provide();
const service2 = container2.userService.provide();

console.log("\nSingleton behavior:");
console.log("Same container, same instance:", service1 === container1.userService.provide());
console.log("Different containers, different instances:", service1 !== service2);

// Factory vs Singleton
const config1 = AppContainer.dbConfig.provide();
const config2 = AppContainer.dbConfig.provide();
console.log("\nFactory behavior:");
console.log("Factory creates new instances:", config1 !== config2);

const db1 = AppContainer.database.provide();
const db2 = AppContainer.database.provide();
console.log("\nSingleton behavior:");
console.log("Singleton reuses same instance:", db1 === db2);
