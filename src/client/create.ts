import { putDbEntry, renderCloset } from "./client.js";
import { sendMessage } from "./connection.js";

import { sha1Obj } from "../shared/hashObject.js";
import { Dialog, closeDialog, openDialog } from "./ui_layout.js";
import { DbEntry, ImagePath } from "../shared/protocol.js";

const createButton = document.getElementById("createButton") as HTMLButtonElement;
createButton.addEventListener("click", async function() {
  renderCreateUI();
  openDialog(Dialog.CREATE);
});

const createEditorClosteNameTextbox = document.getElementById("createEditorClosteNameTextbox") as HTMLInputElement;
const createEditorSizeInput = document.getElementById("createEditorSizeInput") as HTMLInputElement;
//const createEditorFacesDropdown = document.getElementById("createEditorFacesDropdown") as HTMLSelectElement;
//const createEditorMoveFaceUpButton = document.getElementById("createEditorMoveFaceUpButton") as HTMLButtonElement;
//const createEditorMoveFaceDownButton = document.getElementById("createEditorMoveFaceDownButton") as HTMLButtonElement;
const createEditorNumberOfFacesSpinner = document.getElementById("createEditorNumberOfFacesSpinner") as HTMLInputElement;
//const createEditorPerFaceDiv = document.getElementById("createEditorPerFaceDiv") as HTMLDivElement;
//const createEditorCanvas = document.getElementById("createEditorCanvas") as HTMLCanvasElement;
//const createEditorUploadButton = document.getElementById("createEditorUploadButton") as HTMLInputElement;
const createEditorTextarea = document.getElementById("createEditorTextarea") as HTMLTextAreaElement;
const createEditorSaveButton = document.getElementById("createEditorSaveButton") as HTMLButtonElement;
const createEditorCancelButton = document.getElementById("createEditorCancelButton") as HTMLButtonElement;
const createEditorIdTextbox = document.getElementById("createEditorIdTextbox") as HTMLInputElement;
const createEditorCopyIdButton = document.getElementById("createEditorCopyIdButton") as HTMLButtonElement;

let faces: (ImagePath|null)[] = ["checkers/red_pawn.png"];

function getCreatedObject(): DbEntry | null {
  let obj: DbEntry = {};
  let value: string;
  let match: RegExpExecArray | null;

  if ((value = createEditorClosteNameTextbox.value.trim())) {
    obj.closetName = value;
  }

  if ((match = /(\d+)(?:x(\d+))?/.exec(createEditorSizeInput.value))) {
    obj.width = parseInt(match[0]);
    if (match[1]) {
      obj.height = parseInt(match[1]);
    } else {
      obj.height = obj.width;
    }
  } else {
    return null;
  }

  if (faces.filter(x => x == null).length > 0) return null;
  obj.faces = faces as ImagePath[];

  return obj;
}

function renderCreateUI() {
  let obj = getCreatedObject();
  if (obj == null) {
    createEditorTextarea.textContent = "<error>";
    createEditorIdTextbox.value = "";
    createEditorSaveButton.disabled = true;
  } else {
    createEditorTextarea.textContent = JSON.stringify(obj);
    hashObj(obj).then(hash => {
      createEditorIdTextbox.value = hash;
    });
    createEditorSaveButton.disabled = false;
  }
}

[
  createEditorClosteNameTextbox,
  createEditorSizeInput,
  createEditorNumberOfFacesSpinner,
].forEach(element => element.addEventListener("input", renderCreateUI));

createEditorSaveButton.addEventListener("click", async function() {
  let obj = getCreatedObject();
  if (obj == null) return;
  closeDialog();
  sendMessage({
    cmd: "putDbEntry",
    args: obj,
  });

  const hash = await hashObj(obj);
  console.log(hash, obj);
  putDbEntry(hash, obj);
  renderCloset();
});
createEditorCancelButton.addEventListener("click", function() { closeDialog(); });

createEditorCopyIdButton.addEventListener("click", function() {
  let value = createEditorIdTextbox.value;
  if (value.length === 0) return;
  navigator.clipboard.writeText(value);
});

async function browserHashFn(data: BufferSource): Promise<ArrayBuffer> {
  if (window.crypto.subtle == null) {
    console.error("subtle crypto is not available. is this running in a secure context? (https)");
  }
  return window.crypto.subtle.digest("SHA-1", data);
}

function hashObj(o: object) {
  return sha1Obj(browserHashFn, o);
}
