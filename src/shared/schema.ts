import {Schema} from "jsonschema";

function Array(subtype: Schema): Schema {
  return {type: "array", items: subtype};
}
function AnyOf(...subtypes: Schema[]): Schema {
  return {anyOf: subtypes};
}

// Numbers
export const Int: Schema = {type: "integer", minimum: -9999, maximum: 9999};
export const UnisignedInt: Schema = {type: "integer", minimum: 0, maximum: 9999};
export const PositiveInt: Schema = {type: "integer", minimum: 1, maximum: 9999};

// Strings
export const ImagePath: Schema = {type: "string", maxLength: 255, pattern: /^[0-9A-Za-z_-]+(\/[0-9A-Za-z_-]+)*\.png(#\d+,\d+,\d+,\d+)?$/.source};
export const DbEntryId: Schema = {type: "string", minLength: 1, maxLength: 255};
export const RoleId: Schema = {type: "string", minLength: 1, maxLength: 255};
export const ColorWithParameterizedAlpha: Schema = {type: "string", maxLength: 255, pattern: /^rgba\(\d+,\d+,\d+,\$alpha\)$/.source};
export const DisplayName: Schema = {type: "string", minLength: 1, maxLength: 255};
export const RoomCode: Schema = {type: "string", pattern: /[A-Z]{5}/.source};

export const RoomCodeOrNew: Schema = AnyOf(RoomCode, {const: "new"});
export const EncodedMove = Array(AnyOf({type: "string"}, Int)); // TODO: this string is various id types and move codes.

export const DbItem = {type: "object", additionalProperties: false, properties: {
  width: PositiveInt,
  height: PositiveInt,
  faces: Array(ImagePath),

  snapZones: Array({
    type: "object", additionalProperties: false, properties: {
      x: Int,
      y: Int,
      width: PositiveInt,
      height: PositiveInt,
      cellWidth: PositiveInt,
      cellHeight: PositiveInt,
    },
  }),

  closetName: DisplayName,
  thumbnail: ImagePath,
  thumbnailWidth: PositiveInt,
  thumbnailHeight: PositiveInt,
  items: Array(DbEntryId),

  hideFaces: Array(UnisignedInt),
  visionWhitelist: Array(RoleId),
  labelPlayerName: RoleId,
  backgroundColor: ColorWithParameterizedAlpha,
}};

export const protocolSchema: Schema = AnyOf(
  { type: "object", additionalProperties: false, properties: {
    cmd: {const: "joinRoom"},
    args: {type: "object", additionalProperties: false, properties: {
      roomCode: RoomCodeOrNew,
    }, required: ["roomCode"]},
  }, required: ["cmd", "args"]},

  { type: "object", additionalProperties: false, properties: {
    cmd: {const: "changeMyName"},
    args: DisplayName,
  }, required: ["cmd", "args"]},

  { type: "object", additionalProperties: false, properties: {
    cmd: {const: "changeMyRole"},
    args: AnyOf(RoleId, {const: ""}),
  }, required: ["cmd", "args"]},

  { type: "object", additionalProperties: false, properties: {
    cmd: {const: "makeAMove"},
    args: EncodedMove,
  }, required: ["cmd", "args"]},

  { type: "object", additionalProperties: false, properties: {
    cmd: {const: "putDbEntry"},
    args: DbItem,
  }, required: ["cmd", "args"]},
);

// Rewrite references to our exported schemas to use {$ref: "#/$defs/TypeName"}.
// This causes the output file to contain multiple export declarations.
import * as self from "./schema.js";
(function() {
  let replacements = new Map<any, Schema>();
  let $defs: {[index: string]: Schema} = {};
  for (let k in self) {
    let o: Schema = (self as any)[k];
    replacements.set(o, {$ref: "#/$defs/" + k});
    $defs[k] = o;
  }

  function recurse(o: Schema) {
    if (o.anyOf != null) visitCollection(o.anyOf);
    if (o.items != null) visitCollection(o.items);
    if (o.properties != null) visitCollection(o.properties);

    function visitCollection(a: any) {
      for (let k in a) {
        let replacement = replacements.get(a[k])
        if (replacement != null) {
          a[k] = replacement;
          continue;
        }
        recurse(a[k]);
      }
    }
  }
  recurse(protocolSchema);
  (protocolSchema as any).$defs = $defs; // Schema seems to be missing the $defs property definition.
})();
