// Pattern Pretre — generic wrapper that lets controllers inject use cases
// without depending on use-case classes directly. Wiring happens in
// UseCasesProxyModule (DynamicModule).
export class UseCaseProxy<T> {
  constructor(private readonly useCase: T) {}

  getInstance(): T {
    return this.useCase;
  }
}
