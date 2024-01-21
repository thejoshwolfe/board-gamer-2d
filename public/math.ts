
export function programmerError(msg?: string): never { throw new Error(msg); }

export function euclideanMod(numerator: number, denominator: number): number {
  return (numerator % denominator + denominator) % denominator;
}

export function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function operatorCompare(a: number, b: number) {
  return a < b ? -1 : a > b ? 1 : 0;
}
