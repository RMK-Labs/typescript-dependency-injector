import { BaseProvider, Delegate, Factory, Singleton } from "../src/index";

describe("index.ts exports", () => {
  it("should export BaseProvider class", () => {
    expect(BaseProvider).toBeDefined();
    expect(typeof BaseProvider).toBe("function");
  });

  it("should export Factory class", () => {
    expect(Factory).toBeDefined();
    expect(typeof Factory).toBe("function");
  });

  it("should export Singleton class", () => {
    expect(Singleton).toBeDefined();
    expect(typeof Singleton).toBe("function");
  });

  it("should export Delegate class", () => {
    expect(Delegate).toBeDefined();
    expect(typeof Delegate).toBe("function");
  });

  it("should create a Factory instance from exports", () => {
    class TestService {
      getValue(): string {
        return "test";
      }
    }

    const factory = new Factory(TestService);
    expect(factory).toBeInstanceOf(Factory);
    expect(factory).toBeInstanceOf(BaseProvider);

    const instance = factory.provide();
    expect(instance).toBeInstanceOf(TestService);
    expect(instance.getValue()).toBe("test");
  });

  it("should create a Singleton instance from exports", () => {
    class Counter {
      private count = 0;
      increment(): number {
        return ++this.count;
      }
    }

    const singleton = new Singleton(Counter);
    expect(singleton).toBeInstanceOf(Singleton);
    expect(singleton).toBeInstanceOf(Factory);
    expect(singleton).toBeInstanceOf(BaseProvider);

    const instance1 = singleton.provide();
    const instance2 = singleton.provide();
    expect(instance1).toBe(instance2);
    expect(instance1.increment()).toBe(1);
    expect(instance2.increment()).toBe(2);
  });

  it("should create a Delegate instance from exports", () => {
    class Logger {
      log(message: string): string {
        return `LOG: ${message}`;
      }
    }

    const factory = new Factory(Logger);
    const delegate = new Delegate(factory);
    expect(delegate).toBeInstanceOf(Delegate);
    expect(delegate).toBeInstanceOf(BaseProvider);

    const providedFactory = delegate.provide();
    expect(providedFactory).toBe(factory);
  });
});
