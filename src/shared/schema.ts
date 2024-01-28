import {Schema} from "jsonschema";

const string = {type: "string"};
const number = {type: "number"};

// TODO: These could be more constrained.
const ImagePath = string;
const DbEntryId = string;
const RoleId = string;
const ColorWithParameterizedAlpha = string;

function Array(subtype: Schema) {
  return {type: "array", items: subtype};
}

export const DbItem = {type: "object", additionalProperties: false, properties: {
  id: DbEntryId,

  width: number,
  height: number,
  faces: Array(ImagePath),

  snapZones: Array({
    type: "object", additionalProperties: false, properties: {
      x: number,
      y: number,
      width: number,
      height: number,
      cellWidth: number,
      cellHeight: number,
    },
  }),

  closetName: string,
  thumbnail: ImagePath,
  thumbnailWidth: number,
  thumbnailHeight: number,
  items: Array(DbEntryId),

  hideFaces: Array(number),
  visionWhitelist: Array(RoleId),
  labelPlayerName: RoleId,
  backgroundColor: ColorWithParameterizedAlpha,
}, required: ["id"]};

export const protocolSchema: Schema = {
  anyOf: [

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "joinRoom"},
      args: {type: "object", additionalProperties: false, properties: {
        roomCode: string,
      }, required: ["roomCode"]},
    }, required: ["cmd", "args"]},

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "changeMyName"},
      args: string,
    }, required: ["cmd", "args"]},

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "changeMyRole"},
      args: string,
    }, required: ["cmd", "args"]},

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "makeAMove"},
      args: Array({anyOf: [string, number]}),
    }, required: ["cmd", "args"]},

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "putDbEntry"},
      args: DbItem,
    }, required: ["cmd", "args"]},

  ],
};

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
