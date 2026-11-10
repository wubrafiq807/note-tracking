export const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
export function requireFound<T>(document: T | null | undefined): T {
  if (!document) throw fail(404, 'Resource not found');
  return document;
}
