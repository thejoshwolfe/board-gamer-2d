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
      args: {type: "object", additionalProperties: false, properties: {
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
      }, required: ["id"]},
    }, required: ["cmd", "args"]},

  ],
};
