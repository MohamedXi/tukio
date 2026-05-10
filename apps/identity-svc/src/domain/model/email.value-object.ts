import { InvalidEmailException } from '../exception/invalid-email.exception.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;
const MAX_EMAIL_LENGTH = 254;

export class Email {
  private readonly value: string;

  private constructor(normalized: string) {
    this.value = normalized;
  }

  static create(raw: string): Email {
    if (typeof raw !== 'string') {
      throw new InvalidEmailException(String(raw));
    }
    const trimmed = raw.trim().toLowerCase();
    if (
      trimmed.length === 0 ||
      trimmed.length > MAX_EMAIL_LENGTH ||
      !EMAIL_REGEX.test(trimmed)
    ) {
      throw new InvalidEmailException(raw);
    }
    return new Email(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return other instanceof Email && other.value === this.value;
  }
}
