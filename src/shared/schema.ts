
import {Schema} from "jsonschema";

export const protocolSchema: Schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    cmd: {type: "string"},
    args: {},
  },
};
