export function euclideanMod(numerator: number, denominator: number): number {
  return (numerator % denominator + denominator) % denominator;
}

export function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
