import { putDbEntry, renderCloset } from "./client.js";
import { sendMessage } from "./connection.js";

const createButton = document.getElementById("createButton") as HTMLButtonElement;
createButton.addEventListener("click", function() {
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
  console.log(json);

  sendMessage({
    cmd: "putDbEntry",
    args: json,
  });
  putDbEntry(json);
  renderCloset();
});

const example = JSON.stringify({
  id: "checkersPieceCustom",
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
