export class WolfValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WolfValidationError';
  }
}

export class WolfEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WolfEngineError';
  }
}
