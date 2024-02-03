import { putDbEntry, renderCloset } from "./client.js";
import { sendMessage } from "./connection.js";

import { sha1Obj } from "../shared/hashObject.js";

const createButton = document.getElementById("createButton") as HTMLButtonElement;
createButton.addEventListener("click", async function() {
  let text = prompt("Enter the whole JSON, nerd. (TODO: better UI.)", lastEnteredPrompt);
  if (!text) return;
  // Save for later editing in case of an error.
  lastEnteredPrompt = text;

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    alert(e);
  }
  sendMessage({
    cmd: "putDbEntry",
    args: json,
  });

  const hash = await hashObj(json);
  console.log(hash, json);
  putDbEntry(hash, json);
  renderCloset();
});

const example = JSON.stringify({
  closetName: "Checkers Piece (Nonsense)",
  width: 50,
  height: 50,
  thumbnail: "checkers/red_king.png",
  faces: [
    "checkers/red_pawn.png",
    "checkers/black_king.png",
  ],
});
let lastEnteredPrompt = example;

async function browserHashFn(data: BufferSource): Promise<ArrayBuffer> {
  if (window.crypto.subtle == null) {
    console.error("subtle crypto is not available. is this running in a secure context? (https)");
  }
  return window.crypto.subtle.digest("SHA-1", data);
}

function hashObj(o: object) {
  return sha1Obj(browserHashFn, o);
}
