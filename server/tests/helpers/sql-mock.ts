// Shared mock for porsager/postgres tagged-template client.
// Usage: vi.mock("../src/db/client.js", () => import("./helpers/sql-mock.js"))
//
// Handles:
//   sql`SELECT ...`       — tagged-template call, consumes queued row sets
//   sql({ col: val })     — dynamic fragment passthrough (for SET clauses)
//   sql.array(arr)        — array literal passthrough
//   sql.unsafe(str)       — noop
//   sql.end()             — noop

let _results: unknown[][] = [];
const _calls: Array<{ strings: readonly string[]; values: unknown[] }> = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sqlFn(stringsOrObj: any, ...values: unknown[]): any {
  if (Array.isArray(stringsOrObj)) {
    // Tagged-template call: sql`SELECT ...`
    _calls.push({ strings: stringsOrObj as readonly string[], values });
    const next = _results.shift() ?? [];
    return Promise.resolve(next);
  }
  // Object call: sql({...}) used inside template literals for dynamic SET/INSERT fragments
  return { __fragment: stringsOrObj };
}

sqlFn.array = (arr: unknown[]): unknown[] => arr;
sqlFn.unsafe = async (_str: string): Promise<unknown[]> => [];
sqlFn.end = async (): Promise<void> => {};

export const sql = sqlFn;

export function queueRows(...sets: unknown[][]): void {
  _results.push(...sets);
}

export function sqlCalls(): Array<{ strings: readonly string[]; values: unknown[] }> {
  return _calls;
}

export function resetSqlMock(): void {
  _results = [];
  _calls.length = 0;
}
