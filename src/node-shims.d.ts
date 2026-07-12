declare module 'node:test' {
  export default function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  type ThrowsExpectation = RegExp | (new (...args: never[]) => Error);
  const assert: {
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): asserts value;
    match(value: string, regexp: RegExp, message?: string): void;
    rejects(
      block: Promise<unknown> | (() => Promise<unknown>),
      expected?: ThrowsExpectation,
      message?: string,
    ): Promise<void>;
    throws(fn: () => unknown, expected?: ThrowsExpectation, message?: string): void;
  };
  export default assert;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:vm' {
  export function runInNewContext<T = unknown>(code: string): T;
}

declare module 'node:child_process' {
  export function execFileSync(command: string, args: string[], options: { encoding: 'utf8' }): string;
}
