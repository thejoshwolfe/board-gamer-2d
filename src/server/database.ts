import * as crypto from "crypto";

import {DbEntry} from "../shared/protocol.js";

import "../shared/contentAddressable.js";
import { ContentAddressableObjectStore } from "../shared/contentAddressable.js";

async function nodeHashFn(data: BufferSource): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-1", data);
}

let db = new ContentAddressableObjectStore<DbEntry>(nodeHashFn);

export const checkersBoard = await db.put({
  closetName: "Checkers Board",
  width: 400,
  height: 400,
  faces: ["checkers/board.png"],
  snapZones: [
    { cellWidth: 50, cellHeight: 50 },
  ],
});
export const checkersPieceRed = await db.put({
  closetName: "Checkers Piece (Red)",
  width: 50,
  height: 50,
  thumbnail: "checkers/red_king.png",
  faces: [
    "checkers/red_pawn.png",
    "checkers/red_king.png",
  ],
});
export const checkersPieceBlack = await db.put({
  closetName: "Checkers Piece (Black)",
  width: 50,
  height: 50,
  thumbnail: "checkers/black_king.png",
  faces: [
    "checkers/black_pawn.png",
    "checkers/black_king.png",
  ],
});

export const d6 = await db.put({
  closetName: "D6 Die",
  width: 25,
  height: 25,
  thumbnail: "dice/d6_6.png",
  faces: [
    "dice/d6_1.png",
    "dice/d6_2.png",
    "dice/d6_3.png",
    "dice/d6_4.png",
    "dice/d6_5.png",
    "dice/d6_6.png",
  ],
});

export const frenchDeck = await db.put({
  closetName: "French Deck",
  thumbnail: "french_deck/ace_of_spades.png",
  thumbnailWidth: 17,
  thumbnailHeight: 25,
  items: [
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 0*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 1*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 2*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 3*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 4*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 5*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 6*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 7*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 8*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 9*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(10*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(11*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(12*560)+","+(0*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 0*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 1*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 2*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 3*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 4*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 5*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 6*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 7*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 8*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 9*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(10*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(11*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(12*560)+","+(1*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 0*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 1*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 2*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 3*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 4*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 5*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 6*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 7*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 8*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 9*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(10*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(11*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(12*560)+","+(3*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 0*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 1*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 2*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 3*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 4*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 5*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 6*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 7*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 8*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+( 9*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(10*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(11*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
    await db.put({width:50, height:70, faces:["french_deck/fronts.png#"+(12*560)+","+(2*780)+",560,780", "french_deck/back.png"]}),
  ],
});

export const redScreen = await db.put({width:600, height:100, hideFaces:[0], snapZones:[{}], visionWhitelist:["red"  ], backgroundColor:"rgba(255,0,0,$alpha)", labelPlayerName:"red"});
export const blackScreen = await db.put({width:600, height:100, hideFaces:[0], snapZones:[{}], visionWhitelist:["black"], backgroundColor:"rgba(0,0,0,$alpha)",   labelPlayerName:"black"});

export default db;
