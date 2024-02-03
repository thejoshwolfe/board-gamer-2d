
// Provide this from, e.g. data => crypto.subtle.digest("SHA-1", data)
export type LowLevelHashFn = (data: BufferSource) => Promise<ArrayBuffer>;

export function sha1Obj(hashFn: LowLevelHashFn, o: object) {
  let s = JSON.stringify(withSortedKeys(o));
  return sha1String(hashFn, s);
}

export async function sha1String(hashFn: LowLevelHashFn, s: string) {
  const digestBuffer = await hashFn(new TextEncoder().encode(s));
  let digestString = Array.from(new Uint8Array(digestBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  return digestString;
}

function withSortedKeys(o: {[index: string]: any}): {[index: string]: any} {
  let keys = Object.keys(o);
  keys.sort();
  let result: {[index: string]: any} = {};
  for (let key of keys) {
    let value = o[key];
    if (Array.isArray(value)) {
      result[key] = value.map(withSortedKeys);
    } else if (typeof value === "object") {
      result[key] = withSortedKeys(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
