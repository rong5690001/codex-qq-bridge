export function createRunId(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const random = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${random}`;
}
