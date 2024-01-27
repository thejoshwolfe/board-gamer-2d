import {Schema} from "jsonschema";

export const protocolSchema: Schema = {
  anyOf: [

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "joinRoom"},
      args: {type: "object", additionalProperties: false, properties: {
        roomCode: {type: "string"},
      }, required: ["roomCode"]},
    }, required: ["cmd", "args"]},

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "changeMyName"},
      args: {type: "string"},
    }, required: ["cmd", "args"]},

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "changeMyRole"},
      args: {type: "string"},
    }, required: ["cmd", "args"]},

    { type: "object", additionalProperties: false, properties: {
      cmd: {const: "makeAMove"},
      args: {type: "array", items: {
        anyOf: [
          {type: "string"},
          {type: "number"},
        ],
      }},
    }, required: ["cmd", "args"]},

  ],
};
