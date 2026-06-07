export class WolfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WolfValidationError';
  }
}
