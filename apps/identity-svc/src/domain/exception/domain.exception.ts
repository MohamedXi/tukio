export abstract class DomainException extends Error {
  abstract readonly tukioCode: string;
  abstract readonly httpStatus: number;
  abstract readonly title: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
