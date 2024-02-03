import {LowLevelHashFn, sha1Obj} from "../shared/hashObject.js";

export class ContentAddressableObjectStore<Obj extends {[index: string]: any}> {
  index: {[index: string]: Obj} = {};
  is_dirty = false;
  hashFn: LowLevelHashFn;

  constructor(hashFn: LowLevelHashFn) {
    this.hashFn = hashFn;
  }

  async put(o: Obj) {
    let hash = await sha1Obj(this.hashFn, o);
    if (!(hash in this.index)) {
      this.index[hash] = o;
    }
    return hash;
  }
}
