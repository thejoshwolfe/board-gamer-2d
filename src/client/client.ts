import {
  sendMessage, getRoomCode,
  getMyUserId, getMyUserRole,
} from "./connection.js";
import {
  clamp, euclideanMod, operatorCompare, programmerError,
} from "./math.js";
import {
  UserInfo, UserId, MakeAMoveArgs, DbEntry, DbEntryId, RoomState, ObjectState, ImagePath, ObjectId,
} from "../shared/protocol.js";
import {
  setScreenMode, ScreenMode,
  canMoveLockedObjects,
  closeDialog, isDialogOpen, setOverlayZ, toggleHelp,
} from "./ui_layout.js";

const tableDiv = document.getElementById("tableDiv") as HTMLDivElement;
const roomCodeSpan = document.getElementById("roomCodeSpan") as HTMLSpanElement;

const LOADING = "<loading>";
interface Size {width: number, height: number}
let imageUrlToSize: {[index: string]: Size | typeof LOADING} = {};

let gameDefinition: RoomState | null = null;
let database: DbEntry[] | null = null;
let databaseById: {[index: DbEntryId]: DbEntry} = {};
let objectsById: {[index: ObjectId]: ObjectState} = {};

// caches
let objectsWithSnapZones: ObjectState[] = [];
let hiderContainers: ObjectState[] = [];

// undo/redo support
let changeHistory: MakeAMoveArgs[] = [];
let futureChanges: MakeAMoveArgs[] = [];

export function getRoles() {
  return (gameDefinition ?? programmerError()).roles;
}
export function initGame(newDatabase: DbEntry[], game: RoomState, history: MakeAMoveArgs[]) {
  database = newDatabase;
  databaseById = {};
  database.forEach(function(closetObject) {
    databaseById[closetObject.id] = closetObject;
    if (closetObject.faces != null) closetObject.faces.forEach(preloadImagePath);
  });
  gameDefinition = game;
  objectsById = {};
  objectsWithSnapZones = [];
  hiderContainers = [];
  changeHistory = [];
  futureChanges = [];
  for (let i = 0; i < gameDefinition.objects.length; i++) {
    let rawDefinition = gameDefinition.objects[i];
    let id = rawDefinition.id;
    if (id == null) programmerError();

    let object = makeObject(id, rawDefinition.prototype, rawDefinition.x, rawDefinition.y, i, 0);
    object.locked = !!rawDefinition.locked;
    registerObject(object);
  }
  fixFloatingThingZ();

  // replay history
  history.forEach(function(move) {
    makeAMove(move, false);
  });

  roomCodeSpan.textContent = getRoomCode();

  checkForDoneLoading();
}
function parseFacePath(path: ImagePath): {url:string, x?:number, y?:number, width?:number, height?:number} {
  let splitIndex = path.indexOf("#");
  if (splitIndex === -1) {
    return {url:path};
  }
  let url = path.substr(0, splitIndex);
  let cropInfo = path.substr(splitIndex + 1).split(",");
  if (cropInfo.length !== 4) programmerError("malformed url: " + path);
  let x = parseInt(cropInfo[0]);
  let y = parseInt(cropInfo[1]);
  let width = parseInt(cropInfo[2]);
  let height = parseInt(cropInfo[3]);
  if (isNaN(x - y - width - height)) programmerError("malformed url: " + path);
  return {url, x, y, width, height};
}
function preloadImagePath(path: ImagePath) {
  let {url} = parseFacePath(path);
  let size = imageUrlToSize[url];
  if (size != null) return; // already loaded or loading.
  imageUrlToSize[url] = LOADING;
  // Let the host environment cache and deduplicate these.
  let img = new Image();
  img.src = url;
  img.addEventListener("load", function() {
    imageUrlToSize[url] = {
      width: img.width,
      height: img.height,
    };
    checkForDoneLoading();
  });
  // TODO: check for error.
}
function checkForDoneLoading() {
  for (let url in imageUrlToSize) {
    if (imageUrlToSize[url] === LOADING) return; // not done yet.
  }
  // all done loading
  renderAllObjects();
  renderOrder();
  resizeTableToFitEverything();
  fixFloatingThingZ();
}
export function renderAllObjects() {
  getObjects().forEach(object => render(object, false));
}

function makeObject(id: ObjectId, prototypeId: DbEntryId, x: number, y: number, z: number, faceIndex: number): ObjectState {
  let objectDefinition = databaseById[prototypeId];
  if (objectDefinition == null) programmerError("prototypeId not found: " + prototypeId);
  return {
    id: id,
    prototype: prototypeId,
    temporary: false,
    x: x,
    y: y,
    z: z,
    faceIndex: faceIndex,
    locked: false,
    width:  objectDefinition.width  || programmerError(),
    height: objectDefinition.height || programmerError(),
    faces: objectDefinition.faces ?? [],
    snapZones: objectDefinition.snapZones ?? [],
    visionWhitelist: objectDefinition.visionWhitelist ?? [],
    hideFaces: objectDefinition.hideFaces ?? [],
    backgroundColor: objectDefinition.backgroundColor ?? "",
    labelPlayerName: objectDefinition.labelPlayerName ?? "",
  };
}
function registerObject(object: ObjectState) {
  objectsById[object.id] = object;
  if (object.snapZones.length > 0) objectsWithSnapZones.push(object);
  if (object.visionWhitelist.length > 0) hiderContainers.push(object);

  tableDiv.insertAdjacentHTML("beforeend",
    '<div id="object-'+object.id+'" data-id="'+object.id+'" class="gameObject" style="display:none;">' +
      '<div id="stackHeight-'+object.id+'" class="stackHeight" style="display:none;"></div>' +
    '</div>'
  );
  let objectDiv = getObjectDiv(object.id);
  objectDiv.addEventListener("mousedown", onObjectMouseDown);
  objectDiv.addEventListener("mousemove", onObjectMouseMove);
  objectDiv.addEventListener("mouseout",  onObjectMouseOut);
  if (object.backgroundColor !== "") {
    // add a background div
    tableDiv.insertAdjacentHTML("beforeend",
      '<div id="background-'+object.id+'" class="backgroundObject" style="display:none;"></div>'
    );
  }
}
function deleteObject(id: ObjectId) {
  if (hoverObject === objectsById[id]) hoverObject = null;
  delete objectsById[id];
  deleteObjectFromArray(objectsWithSnapZones, id);
  deleteObjectFromArray(hiderContainers, id);
  delete selectedObjectIdToNewProps[id];
  deleteDiv(getObjectDiv(id));
  let backgroundDiv = getBackgroundDiv(id);
  if (backgroundDiv != null) deleteDiv(backgroundDiv);
}
function deleteObjectFromArray(array: ObjectState[], id: ObjectId) {
  for (let i = 0; i < array.length; i++) {
    if (array[i].id === id) {
      array.splice(i, 1);
      break;
    }
  }
}
function deleteDiv(div: HTMLDivElement) {
  if (hoverDiv === div) hoverDiv = null;
  tableDiv.removeChild(div);
}

export function deleteTableAndEverything() {
  closeDialog();
  tableDiv.innerHTML = "";
  database = null;
  databaseById = {};
  gameDefinition = null;
  objectsById = {};
  selectedObjectIdToNewProps = {};
  clearNumberBuffer();
  // leave the image cache alone
}
function findMaxZ(excludingSelection?: {[index: ObjectId]: ObjectState | ObjectTempProps}): number {
  let maxZ: number | null = null;
  getObjects().forEach(function(object) {
    if (excludingSelection != null && object.id in excludingSelection) return;
    let newProps = selectedObjectIdToNewProps[object.id];
    if (newProps == null) newProps = object;
    if (maxZ == null || newProps.z > maxZ) maxZ = newProps.z;
  });
  return maxZ ?? 0;
}
export function fixFloatingThingZ() {
  renderExaminingObjects();
  let z = findMaxZ(examiningObjectsById) + Object.keys(examiningObjectsById).length;
  z++;
  hiderContainers.forEach(function(object) {
    let objectDiv = getObjectDiv(object.id);
    if (object.visionWhitelist.indexOf(getMyUserRole()) === -1) {
      // blocked
      objectDiv.style.zIndex = String(z++);
    } else {
      // see it
      objectDiv.style.zIndex = String(object.z);
    }
  });
  setOverlayZ(z);
}

enum DragMode {
  NONE,
  RECTANGLE_SELECT,
  MOVE_SELECTION,
}
let draggingMode = DragMode.NONE;
export function isDraggingAnything() { return draggingMode !== DragMode.NONE; }

let rectangleSelectStartX = 0;
let rectangleSelectStartY = 0;
let rectangleSelectEndX = 0;
let rectangleSelectEndY = 0;
let selectedObjectIdToNewProps: {[index: ObjectId]: ObjectTempProps} = {};
interface ObjectTempProps {
  x: number,
  y: number,
  z: number,
  faceIndex: number,
}

enum ExamineMode {
  NONE,
  SINGLE,
  MULTI,
}
let examiningMode = ExamineMode.NONE;
let examiningObjectsById: {[index: ObjectId]: ObjectTempProps} = {};

let hoverObject: ObjectState | null = null;
let hoverDiv: HTMLDivElement | null = null;
let lastMouseDragX = 0;
let lastMouseDragY = 0;

let accordionMouseStartX: number | null = null;
let accordionObjectStartX: number | null = null;
let isGKeyDown = false;

function onObjectMouseDown(event: MouseEvent) {
  if (event.button !== 0) return;
  if (examiningMode !== ExamineMode.NONE) return;
  let objectDiv = event.currentTarget as HTMLDivElement;
  let object = objectsById[objectDiv.dataset.id as ObjectId];
  if (isObjectLocked(object)) return; // click thee behind me, satan
  event.preventDefault();
  event.stopPropagation();

  // select
  if (selectedObjectIdToNewProps[object.id] == null) {
    // make a selection
    let numberModifier = consumeNumberModifier();
    if (numberModifier == null) numberModifier = 1;
    if (numberModifier === 1) {
      setSelectedObjects([object]);
    } else {
      let stackId = getStackId(object, object);
      let stackOfObjects = getObjects().filter(function(object) { return getStackId(object, object) === stackId; });
      stackOfObjects.sort(compareZ);
      // we can be pretty sure the object we're clicking is the top.
      if (numberModifier < stackOfObjects.length) {
        stackOfObjects.splice(0, stackOfObjects.length - numberModifier);
      }
      setSelectedObjects(stackOfObjects);
    }
  }

  // begin drag
  draggingMode = DragMode.MOVE_SELECTION;
  lastMouseDragX = eventToMouseX(event, tableDiv);
  lastMouseDragY = eventToMouseY(event, tableDiv);
  if (isGKeyDown) startAccordion();

  bringSelectionToTop();
}
function onObjectMouseMove(event: MouseEvent) {
  if (draggingMode != DragMode.NONE) return;
  let objectDiv = event.currentTarget as HTMLDivElement;
  let object = objectsById[objectDiv.dataset.id as ObjectId];
  if (isObjectLocked(object)) return;
  setHoverObject(object);
}
function onObjectMouseOut(event: MouseEvent) {
  let objectDiv = event.currentTarget as HTMLDivElement;
  let object = objectsById[objectDiv.dataset.id as ObjectId];
  if (hoverObject === object) {
    setHoverObject(null);
  }
}

function bringSelectionToTop() {
  // bring selection to top
  // effectively do a stable sort.
  let selection = selectedObjectIdToNewProps;
  let newPropses: ObjectTempProps[] = [];
  for (let id in selection) {
    newPropses.push(selection[id]);
  }
  newPropses.sort(compareZ);
  let z = findMaxZ(selection);
  newPropses.forEach(function(newProps, i) {
    newProps.z = z + i + 1; // This modifies `selection`.
  });
  renderAndMaybeCommitSelection(selection, true);
  fixFloatingThingZ();
}

tableDiv.addEventListener("mousedown", function(event) {
  if (event.button !== 0) return;
  // clicking the table
  event.preventDefault();
  if (examiningMode !== ExamineMode.NONE) return;
  draggingMode = DragMode.RECTANGLE_SELECT;
  rectangleSelectStartX = eventToMouseX(event, tableDiv);
  rectangleSelectStartY = eventToMouseY(event, tableDiv);
  setSelectedObjects([]);
});

document.addEventListener("mousemove", function(event) {
  let x = eventToMouseX(event, tableDiv);
  let y = eventToMouseY(event, tableDiv);
  if (draggingMode === DragMode.RECTANGLE_SELECT) {
    rectangleSelectEndX = x;
    rectangleSelectEndY = y;
    renderSelectionRectangle();
    (function() {
      let minX = rectangleSelectStartX;
      let minY = rectangleSelectStartY;
      let maxX = rectangleSelectEndX;
      let maxY = rectangleSelectEndY;
      if (minX > maxX) { let tmp = maxX; maxX = minX; minX = tmp; }
      if (minY > maxY) { let tmp = maxY; maxY = minY; minY = tmp; }
      let newSelectedObjects: ObjectState[] = [];
      getObjects().forEach(function(object) {
        if (isObjectLocked(object)) return;
        if (object.x > maxX) return;
        if (object.y > maxY) return;
        if (object.x + object.width  < minX) return;
        if (object.y + object.height < minY) return;
        newSelectedObjects.push(object);
      });
      setSelectedObjects(newSelectedObjects);
    })();
  } else if (draggingMode === DragMode.MOVE_SELECTION) {
    if (accordionMouseStartX != null) {
      // accordion drag
      let dx = x - accordionMouseStartX;
      let objectStartX = accordionObjectStartX!;
      let objects: ObjectState[] = [];
      for (let id in selectedObjectIdToNewProps) {
        objects.push(objectsById[id]);
      }
      objects.sort(compareZ);
      objects.forEach(function(object, i) {
        let newProps = selectedObjectIdToNewProps[object.id];
        let factor = i === objects.length - 1 ? 1 : i / (objects.length - 1);
        newProps.x = Math.round(objectStartX + dx * factor);
        render(object, false);
      });
    } else {
      // normal drag
      let dx = x - lastMouseDragX;
      let dy = y - lastMouseDragY;
      Object.keys(selectedObjectIdToNewProps).forEach(function(id) {
        let object = objectsById[id];
        let newProps = selectedObjectIdToNewProps[id];
        newProps.x = Math.round(newProps.x + dx);
        newProps.y = Math.round(newProps.y + dy);
        render(object, false);
      });
    }
    renderOrder();
    resizeTableToFitEverything();
    lastMouseDragX = x;
    lastMouseDragY = y;
  }
});
document.addEventListener("mouseup", function() {
  if (draggingMode === DragMode.RECTANGLE_SELECT) {
    draggingMode = DragMode.NONE;
    renderSelectionRectangle();
  } else if (draggingMode === DragMode.MOVE_SELECTION) {
    draggingMode = DragMode.NONE;
    // snap to grid
    for (let id in selectedObjectIdToNewProps) {
      let object = objectsById[id];
      let newProps = selectedObjectIdToNewProps[id];
      if (snapToSnapZones(object, newProps)) {
        render(object, true);
      }
    }
    commitSelection(selectedObjectIdToNewProps);
    resizeTableToFitEverything();
    renderOrder();
  }
});

function setHoverObject(object: ObjectState | null) {
  if (hoverObject === object) return;
  hoverObject = object;
  setHoverDiv(hoverObject != null ? getObjectDiv(hoverObject.id) : null);
}
function setHoverDiv(div: HTMLDivElement | null) {
  if (hoverDiv === div) return;
  if (hoverDiv != null) hoverDiv.classList.remove("hoverSelect");
  hoverDiv = div;
  if (hoverDiv != null) hoverDiv.classList.add("hoverSelect");
}
function setSelectedObjects(objects: ObjectState[]) {
  for (let id in selectedObjectIdToNewProps) {
    let objectDiv = getObjectDiv(id);
    objectDiv.classList.remove("selected");
  }
  selectedObjectIdToNewProps = {};
  objects.forEach(function(object) {
    selectedObjectIdToNewProps[object.id] = newPropsForObject(object);
  });
  for (let id in selectedObjectIdToNewProps) {
    let objectDiv = getObjectDiv(id);
    objectDiv.classList.add("selected");
  }

  if (hoverObject != null) {
    if (hoverObject.id in selectedObjectIdToNewProps) {
      // better than hovering
      getObjectDiv(hoverObject.id).classList.remove("hoverSelect");
    } else {
      // back to just hovering
      getObjectDiv(hoverObject.id).classList.add("hoverSelect");
    }
  }
}
function newPropsForObject(object: ObjectState): ObjectTempProps {
  return {
    x: object.x,
    y: object.y,
    z: object.z,
    faceIndex: object.faceIndex,
  };
}
function getEffectiveSelection(): {[index: ObjectId]: ObjectTempProps} {
  // if you make changes, call renderAndMaybeCommitSelection
  if (Object.keys(selectedObjectIdToNewProps).length > 0) return selectedObjectIdToNewProps;
  if (hoverObject != null) {
    return {
      [hoverObject.id]: newPropsForObject(hoverObject),
    };
  }
  return {};
}
function renderAndMaybeCommitSelection(selection: {[index: ObjectId]: ObjectTempProps}, isAnimated: boolean) {
  let objectsToRender: ObjectState[] = [];
  // render
  for (let id in selection) {
    let object = objectsById[id];
    let newProps = selection[id];
    if (!(object.x === newProps.x &&
          object.y === newProps.y &&
          object.z === newProps.z &&
          object.faceIndex === newProps.faceIndex)) {
      objectsToRender.push(object);
    }
  }
  if (draggingMode === DragMode.NONE) {
    // if we're dragging, don't commit yet
    commitSelection(selection);
  }
  // now that we've possibly committed a temporary selection, we can render.
  objectsToRender.forEach(object => render(object, isAnimated));
  renderOrder();
  resizeTableToFitEverything();

  // it's too late to use this
  clearNumberBuffer();
}
function commitSelection(selection: {[index: ObjectId]: ObjectTempProps}) {
  let move: any[] = []; // TODO
  move.push(getMyUserId());
  for (let id in selection) {
    let object = objectsById[id];
    let newProps = selection[id];
    if (object.x         !== newProps.x         ||
        object.y         !== newProps.y         ||
        object.z         !== newProps.z         ||
        object.faceIndex !== newProps.faceIndex ||
        object.temporary) {
      if (object.temporary) {
        object.x = newProps.x;
        object.y = newProps.y;
        object.z = newProps.z;
        object.faceIndex = newProps.faceIndex;
        object.temporary = false;
        move.push("c"); // create
        pushObjectProps(move, object);
      } else {
        move.push("m", // move
          object.id,
          object.x,
          object.y,
          object.z,
          object.faceIndex,
          newProps.x,
          newProps.y,
          newProps.z,
          newProps.faceIndex);
        // anticipate
        object.x = newProps.x;
        object.y = newProps.y;
        object.z = newProps.z;
        object.faceIndex = newProps.faceIndex;
      }
    }
  }
  if (move.length <= 1) return;
  let message = {
    cmd: "makeAMove",
    args: move,
  };
  sendMessage(message);
  pushChangeToHistory(move);
}
function pushObjectProps(move: any[], object: ObjectState) { // TODO
  move.push(
    object.id,
    object.prototype,
    object.x,
    object.y,
    object.z,
    object.faceIndex);
}
const objectPropCount = 6;
function consumeObjectProps(move: any[], i: number): ObjectState { // TODO
  let object = makeObject(
    move[i++], // id
    move[i++], // prototypeId
    move[i++], // x
    move[i++], // y
    move[i++], // z
    move[i++], // faceIndex
  );
  return object;
}

const SHIFT = 1;
const CTRL = 2;
const ALT = 4;
function getModifierMask(event: MouseEvent | KeyboardEvent) {
  return (
    (event.shiftKey ? SHIFT : 0) |
    (event.ctrlKey ? CTRL : 0) |
    (event.altKey ? ALT : 0)
  );
}
document.addEventListener("keydown", function(event: KeyboardEvent) {
  if (isDialogOpen()) {
    if (event.keyCode === 27) closeDialog();
    return;
  }
  let modifierMask = getModifierMask(event);
  switch (event.keyCode) {
    case "R".charCodeAt(0):
      if (modifierMask === 0) { rollSelection(); break; }
      return;
    case "S".charCodeAt(0):
      if (modifierMask === 0) { shuffleSelection(); break; }
      return; 
    case "F".charCodeAt(0):
      if (modifierMask === 0) { flipOverSelection(); break; }
      return;
    case "G".charCodeAt(0):
      if (modifierMask === 0 && accordionMouseStartX == null) { groupSelection(); startAccordion(); isGKeyDown = true; break; }
      return;
    case 27: // Escape
      if (modifierMask === 0 && numberTypingBuffer.length > 0) { clearNumberBuffer(); break; }
      if (modifierMask === 0 && draggingMode === DragMode.MOVE_SELECTION) { cancelMove(); break; }
      if (modifierMask === 0 && draggingMode === DragMode.NONE)           { setSelectedObjects([]); break; }
      return;
    case 46: // Delete
      if (modifierMask === 0) { deleteSelection(); break; }
      return;
    case "Z".charCodeAt(0):
      if (draggingMode === DragMode.NONE && modifierMask === CTRL)         { undo(); break; }
      if (draggingMode === DragMode.NONE && modifierMask === (CTRL|SHIFT)) { redo(); break; }
      if (modifierMask === 0)     { examineSingle(); break; }
      if (modifierMask === SHIFT) { examineMulti(); break; }
      return;
    case "Y".charCodeAt(0):
      if (modifierMask === CTRL) { redo(); break; }
      return;
    case 191: // slash/question mark?
      if (modifierMask === SHIFT) { toggleHelp(); break; }
      return;

    case 48: case 49: case 50: case 51: case 52:  case 53:  case 54:  case 55:  case 56:  case 57:  // number keys
    case 96: case 97: case 98: case 99: case 100: case 101: case 102: case 103: case 104: case 105: // numpad
      let numberValue = event.keyCode < 96 ? event.keyCode - 48 : event.keyCode - 96;
      if (modifierMask === 0) { typeNumber(numberValue); break; }
      return;

    default: return;
  }
  event.preventDefault();
});
document.addEventListener("keyup", function(event: KeyboardEvent) {
  let modifierMask = getModifierMask(event);
  switch (event.keyCode) {
    case "Z".charCodeAt(0):
      unexamine();
      break;
    case "G".charCodeAt(0):
      if (modifierMask === 0) { stopAccordion(); isGKeyDown = false; break; }
      return;
    default: return;
  }
  event.preventDefault();
});

function startAccordion() {
  if (draggingMode !== DragMode.MOVE_SELECTION) return;
  accordionMouseStartX = lastMouseDragX;
  for (let id in selectedObjectIdToNewProps) {
    // they're all the same
    accordionObjectStartX = selectedObjectIdToNewProps[id].x;
    break;
  }
}
function stopAccordion() {
  accordionMouseStartX = null;
  accordionObjectStartX = null;
}

function flipOverSelection() {
  let selection = getEffectiveSelection();
  for (let id in selection) {
    let object = objectsById[id];
    let newProps = selection[id];
    newProps.faceIndex += 1;
    if (object.faces.length === newProps.faceIndex) {
      newProps.faceIndex = 0;
    }
  }
  renderAndMaybeCommitSelection(selection, false);
  renderOrder();
}
function rollSelection() {
  let selection = getEffectiveSelection();
  for (let id in selection) {
    let object = objectsById[id];
    let newProps = selection[id];
    newProps.faceIndex = Math.floor(Math.random() * object.faces.length);
  }
  renderAndMaybeCommitSelection(selection, false);
  renderOrder();
}
function cancelMove() {
  let selection = selectedObjectIdToNewProps;
  for (let id in selection) {
    let object = objectsById[id];
    if (object.temporary) {
      deleteObject(id);
    } else {
      let newProps = selection[id];
      newProps.x = object.x;
      newProps.y = object.y;
      newProps.z = object.z;
      newProps.faceIndex = object.faceIndex;
      render(object, true);
    }
  }
  draggingMode = DragMode.NONE;
  renderOrder();
  resizeTableToFitEverything();
  fixFloatingThingZ();
}
function deleteSelection() {
  let selection = getEffectiveSelection();
  let objects: ObjectState[] = [];
  for (let id in selection) {
    objects.push(objectsById[id]);
  }
  let partialDeletion = false;
  let numberModifier = consumeNumberModifier();
  if (numberModifier != null && numberModifier < objects.length) {
    // only delete the top N objects
    objects.sort(compareZ);
    objects.splice(0, objects.length - numberModifier);
    partialDeletion = true;
  }

  let move: any[] = []; // TODO
  objects.forEach(function(object) {
    if (!object.temporary) {
      move.push("d"); // delete
      pushObjectProps(move, object);
    }
    deleteObject(object.id);
  });
  if (move.length > 0) {
    move.unshift(getMyUserId());
    sendMessage({cmd:"makeAMove", args:move});
    pushChangeToHistory(move);
  }

  if (draggingMode === DragMode.MOVE_SELECTION && !partialDeletion) draggingMode = DragMode.NONE;
  renderOrder();
  resizeTableToFitEverything();
  fixFloatingThingZ();
}
function shuffleSelection() {
  let selection: {[index: ObjectId]: ObjectTempProps} = {};
  if (Object.keys(selectedObjectIdToNewProps).length > 0) {
    // real selection
    selection = selectedObjectIdToNewProps;
  } else if (hoverObject != null) {
    // select all objects we're hovering over in this stack
    let stackId = getStackId(hoverObject, hoverObject);
    getObjects().forEach(function(object) {
      if (stackId !== getStackId(object, object)) return;
      selection[object.id] = newPropsForObject(object);
    });
  } else {
    // no selection
    return;
  }

  let newPropsArray: ObjectTempProps[] = [];
  for (let id in selection) {
    newPropsArray.push(selection[id]);
  }
  for (let i = 0; i < newPropsArray.length; i++) {
    let otherIndex = Math.floor(Math.random() * (newPropsArray.length - i)) + i;
    let tempX = newPropsArray[i].x;
    let tempY = newPropsArray[i].y;
    let tempZ = newPropsArray[i].z;
    newPropsArray[i].x = newPropsArray[otherIndex].x;
    newPropsArray[i].y = newPropsArray[otherIndex].y;
    newPropsArray[i].z = newPropsArray[otherIndex].z;
    newPropsArray[otherIndex].x = tempX;
    newPropsArray[otherIndex].y = tempY;
    newPropsArray[otherIndex].z = tempZ;
  }
  renderAndMaybeCommitSelection(selection, true);
  renderOrder();
  resizeTableToFitEverything();
}
function groupSelection() {
  let selection = getEffectiveSelection();
  let selectionLength = Object.keys(selection).length;
  if (selectionLength <= 1) return;
  // find the weighted center (average location)
  let totalX = 0;
  let totalY = 0;
  for (let id in selection) {
    let newProps = selection[id];
    totalX += newProps.x;
    totalY += newProps.y;
  }
  // who is closest to the weighted center?
  let averageX = totalX / selectionLength;
  let averageY = totalY / selectionLength;
  let medianNewProps: ObjectTempProps | null = null;
  let shortestDistanceSquared = Infinity;
  for (let id in selection) {
    let newProps = selection[id];
    let dx = newProps.x - averageX;
    let dy = newProps.y - averageY;
    let distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < shortestDistanceSquared) {
      shortestDistanceSquared = distanceSquared;
      medianNewProps = newProps;
    }
  }
  // everybody move to the center
  for (let id in selection) {
    let newProps = selection[id];
    newProps.x = medianNewProps!.x;
    newProps.y = medianNewProps!.y;
  }
  renderAndMaybeCommitSelection(selection, true);
  renderOrder();
  resizeTableToFitEverything();
}
function examineSingle() {
  if (examiningMode === ExamineMode.SINGLE) return; // ignore key repeat
  unexamine();
  examiningMode = ExamineMode.SINGLE;
  examiningObjectsById = {};
  if (hoverObject == null) return;
  // ignore the newProps in selectedObjectIdToNewProps, because it doesn't really matter
  examiningObjectsById[hoverObject.id] = newPropsForObject(hoverObject);
  renderExaminingObjects();
}
function examineMulti() {
  if (examiningMode === ExamineMode.MULTI) return;
  unexamine();
  examiningMode = ExamineMode.MULTI;

  let selection: {[index: ObjectId]: ObjectTempProps} = {};
  if (Object.keys(selectedObjectIdToNewProps).length > 0) {
    // real selection
    selection = selectedObjectIdToNewProps;
  } else if (hoverObject != null) {
    // choose all objects overlapping the hover object
    let hoverX = hoverObject.x;
    let hoverY = hoverObject.y;
    let hoverWidth  = hoverObject.width;
    let hoverHeight = hoverObject.height;
    getObjects().forEach(function(object) {
      if (isObjectLocked(object)) return; // don't look at me
      if (object.x >= hoverX   + hoverWidth)    return;
      if (object.y >= hoverY   + hoverHeight)   return;
      if (hoverX   >= object.x + object.width)  return;
      if (hoverY   >= object.y + object.height) return;
      selection[object.id] = newPropsForObject(object);
    });
  } else {
    // no selection
    return;
  }

  examiningObjectsById = selection;
  renderExaminingObjects();
}
function unexamine() {
  if (examiningMode === ExamineMode.NONE) return;
  examiningMode = ExamineMode.NONE;
  let selection = examiningObjectsById;
  examiningObjectsById = {};
  for (let id in selection) {
    render(objectsById[id], true);
  }
  renderOrder();
}
function isObjectLocked(object: ObjectState): boolean {
  return object.locked && !canMoveLockedObjects();
}

let numberTypingBuffer = "";
function typeNumber(numberValue: number) {
  if (numberTypingBuffer.length >= 3) return; // 999 is the max.
  numberTypingBuffer += String(numberValue);
  renderNumberBuffer();
}
function consumeNumberModifier(): number | null {
  if (numberTypingBuffer.length === 0) return null;
  let result = parseInt(numberTypingBuffer, 10);
  numberTypingBuffer = "";
  renderNumberBuffer();
  return result;
}
function clearNumberBuffer() {
  if (numberTypingBuffer.length === 0) return;
  numberTypingBuffer = "";
  renderNumberBuffer();
}

export function renderCloset(closetUl: HTMLUListElement) {
  closetUl.innerHTML = database!.filter(function(closetObject) {
    // TODO: show groups with items
    return closetObject.closetName != null;
  }).map(function(closetObject) {
    let id        = closetObject.id;
    let name      = closetObject.closetName!;
    let thumbnail = closetObject.thumbnail       ?? (closetObject.faces ?? programmerError())[0];
    let width     = closetObject.thumbnailWidth  ?? 25;
    let height    = closetObject.thumbnailHeight ?? 25;
    // TODO: sanitize?
    return '<li data-id="'+id+'"><img src="'+thumbnail+'" width='+width+' height='+height+'>'+name+'</li>';
  }).join("");
  let collection = closetUl.getElementsByTagName("li");
  for (let i = 0; i < collection.length; i++) {
    let li = collection[i] as HTMLLIElement;
    li.addEventListener("mousedown", onClosetObjectMouseDown);
    li.addEventListener("mousemove", onClosetObjectMouseMove);
    li.addEventListener("mouseout",  onClosetObjectMouseOut);
  }
}
function onClosetObjectMouseDown(event: MouseEvent) {
  if (event.button !== 0) return;
  if (examiningMode !== ExamineMode.NONE) return;
  event.preventDefault();
  event.stopPropagation();
  let li = event.currentTarget as HTMLLIElement;
  let x = li.getBoundingClientRect().left - tableDiv.getBoundingClientRect().left;
  let y = li.getBoundingClientRect().top  - tableDiv.getBoundingClientRect().top;
  let closetId = li.dataset.id as DbEntryId;
  let closetObject = databaseById[closetId];
  let prototypeIds = closetObject.items;
  if (prototypeIds == null) {
    prototypeIds = [closetObject.id];
  }

  // create temporary objects
  let numberModifier = consumeNumberModifier();
  if (numberModifier == null) numberModifier = 1;
  let stackOfObjects: ObjectState[] = [];
  let z = findMaxZ();
  z++;
  for (let i = 0; i < numberModifier; i++) {
    prototypeIds.forEach(function(prototypeId) {
      stackOfObjects.push(makeTemporaryObject(prototypeId, x, y, z++));
    });
  }
  setSelectedObjects(stackOfObjects);

  // begin drag
  draggingMode = DragMode.MOVE_SELECTION;
  lastMouseDragX = eventToMouseX(event, tableDiv);
  lastMouseDragY = eventToMouseY(event, tableDiv);

  // bring selection to top
  bringSelectionToTop();
}
function onClosetObjectMouseMove(event: MouseEvent) {
  if (draggingMode != DragMode.NONE) return;
  setHoverDiv(event.currentTarget as HTMLDivElement);
}
function onClosetObjectMouseOut(event: MouseEvent) {
  if (hoverDiv === event.currentTarget) {
    setHoverDiv(null);
  }
}

function makeTemporaryObject(prototypeId: DbEntryId, x: number, y: number, z: number): ObjectState {
  let id = generateRandomId();
  let object = makeObject(id, prototypeId, x, y, z, 0);
  object.temporary = true;
  object.locked = false;
  registerObject(object);
  render(object, false);
  return object;
}

function undo() { undoOrRedo(changeHistory, futureChanges); }
function redo() { undoOrRedo(futureChanges, changeHistory); }
function undoOrRedo(thePast: MakeAMoveArgs[], theFuture: MakeAMoveArgs[]) {
  clearNumberBuffer();
  if (thePast.length === 0) return;
  let newMove = reverseChange(thePast.pop());
  sendMessage({cmd:"makeAMove", args:newMove});
  theFuture.push(newMove);
}
function reverseChange(move: MakeAMoveArgs): MakeAMoveArgs {
  let newMove: MakeAMoveArgs = [getMyUserId()];
  let i = 0;
  move[i++]; // ignore userId
  while (i < move.length) {
    let actionCode = move[i++];
    switch (actionCode) {
      case "c": { // create -> delete
        let object = consumeObjectProps(move, i);
        i += objectPropCount;
        newMove.push("d"); // delete
        pushObjectProps(newMove, object);
        deleteObject(object.id);
        break;
      }
      case "d": { // delete -> create
        let object = consumeObjectProps(move, i);
        i += objectPropCount;
        newMove.push("c"); // create
        pushObjectProps(newMove, object);
        registerObject(object);
        render(object, true);
        break;
      }
      case "m": { // move -> move
        let object = objectsById[move[i++]];
        let fromX         =      move[i++];
        let fromY         =      move[i++];
        let fromZ         =      move[i++];
        let fromFaceIndex =      move[i++];
        let   toX         =      move[i++];
        let   toY         =      move[i++];
        let   toZ         =      move[i++];
        let   toFaceIndex =      move[i++];
        object.x         = fromX;
        object.y         = fromY;
        object.z         = fromZ;
        object.faceIndex = fromFaceIndex;
        let newProps = selectedObjectIdToNewProps[object.id];
        if (newProps != null) {
          newProps.x         = object.x;
          newProps.y         = object.y;
          newProps.z         = object.z;
          newProps.faceIndex = object.faceIndex;
        }
        newMove.push("m", // move
          object.id,
          toX,
          toY,
          toZ,
          toFaceIndex,
          fromX,
          fromY,
          fromZ,
          fromFaceIndex);
        render(object, true);
        break;
      }
      default: programmerError();
    }
  }
  renderOrder();
  resizeTableToFitEverything();

  return newMove;
}
function pushChangeToHistory(change: MakeAMoveArgs) {
  changeHistory.push(change);
  futureChanges = [];
}

function eventToMouseX(event: MouseEvent, div: HTMLDivElement) { return event.clientX - div.getBoundingClientRect().left; }
function eventToMouseY(event: MouseEvent, div: HTMLDivElement) { return event.clientY - div.getBoundingClientRect().top; }


function render(object: ObjectState, isAnimated: boolean) {
  if (object.id in examiningObjectsById) return; // different handling for this
  let x = object.x;
  let y = object.y;
  let z = object.z;
  let faceIndex = object.faceIndex;
  let newProps = selectedObjectIdToNewProps[object.id];
  if (newProps != null) {
    x = newProps.x;
    y = newProps.y;
    z = newProps.z;
    faceIndex = newProps.faceIndex;
  }
  if (object.locked) {
    z = 0;
  } else {
    for (let i = 0; i < hiderContainers.length; i++) {
      let hiderContainer = hiderContainers[i];
      if (hiderContainer.x <= x+object.width /2 && x+object.width /2 <= hiderContainer.x + hiderContainer.width &&
          hiderContainer.y <= y+object.height/2 && y+object.height/2 <= hiderContainer.y + hiderContainer.height) {
        if (hiderContainer.visionWhitelist.indexOf(getMyUserRole()) === -1) {
          // blocked
          let forbiddenFaces = hiderContainer.hideFaces;
          let betterFaceIndex = -1;
          for (let j = 0; j < object.faces.length; j++) {
            let tryThisIndex = (faceIndex + j) % object.faces.length;
            if (forbiddenFaces.indexOf(tryThisIndex) === -1) {
              betterFaceIndex = tryThisIndex;
              break;
            }
          }
          faceIndex = betterFaceIndex;
        }
        break;
      }
    }
  }
  let objectDiv = getObjectDiv(object.id);
  if (isAnimated) {
    objectDiv.classList.add("animatedMovement");
  } else {
    objectDiv.classList.remove("animatedMovement");
  }
  objectDiv.style.left = x + "px";
  objectDiv.style.top  = y + "px";
  objectDiv.style.width  = object.width  + "px";
  objectDiv.style.height = object.height + "px";
  objectDiv.style.zIndex = String(z);
  if (object.faces.length > 0) {
    let facePath = object.faces[faceIndex];
    let {url} = parseFacePath(facePath);
    objectDiv.dataset.facePath = facePath;
    objectDiv.style.backgroundImage = `url(${url})`;
    renderSize(objectDiv, object.width, object.height);
  } else if (object.backgroundColor !== "") {
    objectDiv.style.backgroundColor = object.backgroundColor.replace(/\$alpha/, "0.4");
    objectDiv.style.borderColor = "rgba(255,255,255,0.8)";
    objectDiv.style.borderWidth = "3px";
    objectDiv.style.borderStyle = "solid";
    objectDiv.style.pointerEvents = "none";
    // adjust rectangle, because the border screws up everything
    objectDiv.style.left = (x - 3) + "px";
    objectDiv.style.top  = (y - 3) + "px";
  } else {
    programmerError("don't know how to render object");
  }
  objectDiv.style.display = "block";

  if (object.backgroundColor !== "") {
    let backgroundDiv = getBackgroundDiv(object.id) ?? programmerError();
    if (isAnimated) {
      backgroundDiv.classList.add("animatedMovement");
    } else {
      backgroundDiv.classList.remove("animatedMovement");
    }
    backgroundDiv.style.left = x + "px";
    backgroundDiv.style.top = y + "px";
    backgroundDiv.style.width  = object.width  + "px";
    backgroundDiv.style.height = object.height + "px";
    backgroundDiv.style.zIndex = String(0);
    backgroundDiv.style.display = "block";
    backgroundDiv.style.backgroundColor = object.backgroundColor.replace(/\$alpha/, "1.0");
  }
}
function renderExaminingObjects() {
  // sort by z order. bottom-to-top is left-to-right.
  let objects: ObjectState[] = [];
  for (let id in examiningObjectsById) {
    objects.push(objectsById[id]);
  }
  objects.sort(function(a, b) {
    return compareZ(examiningObjectsById[a.id], examiningObjectsById[b.id]);
  });

  // how far in can we zoom?
  let totalWidth = 0;
  let maxHeight = 0;
  objects.forEach(function(object) {
    totalWidth += object.width;
    if (object.height > maxHeight) maxHeight = object.height;
  });

  let windowWidth  = window.innerWidth;
  let windowHeight = window.innerHeight;
  let windowAspectRatio = windowWidth / windowHeight;
  let objectsAspectRatio = totalWidth / maxHeight;

  let bigHeight: number | null = null;
  if (windowAspectRatio < objectsAspectRatio) {
    bigHeight = windowWidth  / objectsAspectRatio;
  } else {
    bigHeight = windowHeight;
  }
  let zoomFactor = bigHeight / maxHeight;
  if (zoomFactor < 1.0) {
    // don't ever zoom out with this function. prefer overlapping objects.
    zoomFactor = 1.0;
    totalWidth = windowWidth;
  }
  let averageWidth = totalWidth / objects.length;

  let maxZ = findMaxZ();
  for (let i = 0; i < objects.length; i++) {
    let object = objects[i];
    let renderWidth  = object.width  * zoomFactor;
    let renderHeight = object.height * zoomFactor;
    let renderX = averageWidth * i * zoomFactor;
    let renderY = (windowHeight - renderHeight) / 2;
    let objectDiv = getObjectDiv(object.id);
    objectDiv.classList.add("animatedMovement");
    objectDiv.style.left = (renderX + window.scrollX) + "px";
    objectDiv.style.top  = (renderY + window.scrollY) + "px";
    renderSize(objectDiv, renderWidth, renderHeight);
    objectDiv.style.zIndex = String(maxZ + i + 3);
    let stackHeightDiv = getStackHeightDiv(object.id);
    stackHeightDiv.style.display = "none";
  }
}
function renderSize(objectDiv: HTMLDivElement, renderWidth: number, renderHeight: number) {
  objectDiv.style.width  = renderWidth  + "px";
  objectDiv.style.height = renderHeight + "px";
  let {url, x, y, width, height} = parseFacePath(objectDiv.dataset.facePath as ImagePath);
  if (x != null) {
    if (!(y != null && width != null && height != null)) programmerError();
    let scaleX = renderWidth  / width;
    let scaleY = renderHeight / height;
    let backgroundSize = imageUrlToSize[url] as Size;
    //objectDiv.style.backgroundRepeat = "no-repeat";
    objectDiv.style.backgroundPosition = `-${x * scaleX}px -${y * scaleY}px`;
    objectDiv.style.backgroundSize = `${backgroundSize.width * scaleX}px ${backgroundSize.height * scaleY}px`;
  } else {
    objectDiv.style.backgroundPosition = "";
    objectDiv.style.backgroundSize = "";
  }
}
function renderOrder() {
  let sizeAndLocationToIdAndZList: {
    [index: StackId]: {id: ObjectId, z: number}[],
  } = {};
  getObjects().forEach(function(object) {
    let newProps = selectedObjectIdToNewProps[object.id];
    if (newProps == null) newProps = object;
    if (object.labelPlayerName !== "") {
      // not really a stack height
      return;
    }
    let key = getStackId(newProps, object);
    let idAndZList = sizeAndLocationToIdAndZList[key];
    if (idAndZList == null) idAndZList = sizeAndLocationToIdAndZList[key] = [];
    idAndZList.push({id:object.id, z:newProps.z});
  });
  for (let key in sizeAndLocationToIdAndZList) {
    let idAndZList = sizeAndLocationToIdAndZList[key];
    idAndZList.sort(compareZ);
    idAndZList.forEach(function(idAndZ, i) {
      if (idAndZ.id in examiningObjectsById) return;
      let stackHeightDiv = getStackHeightDiv(idAndZ.id);
      if (i > 0) {
        stackHeightDiv.textContent = String(i + 1);
        stackHeightDiv.style.display = "block";
      } else {
        stackHeightDiv.style.display = "none";
      }
    });
  }
}
export function renderPlayerLabelObjects(usersById: {[index: UserId]: UserInfo}, userIds: UserId[], myUser: UserInfo) {
  getObjects().forEach(function(object) {
    if (object.labelPlayerName === "") return;
    let userName: string | null = null;
    if (object.labelPlayerName === myUser.role) {
      userName = "You";
    } else {
      for (let i = 0; i < userIds.length; i++) {
        if (usersById[userIds[i]].role === object.labelPlayerName) {
          userName = usersById[userIds[i]].userName;
          break;
        }
      }
    }
    let roleName: string | null = null;
    for (let i = 0; i < gameDefinition!.roles.length; i++) {
      if (gameDefinition!.roles[i].id === object.labelPlayerName) {
        roleName = gameDefinition!.roles[i].name;
        break;
      }
    }
    let labelText: string | null = null;
    if (userName != null) {
      labelText = userName + " ("+roleName+")";
    } else {
      labelText = roleName;
    }
    let stackHeightDiv = getStackHeightDiv(object.id);
    stackHeightDiv.textContent = labelText;
    stackHeightDiv.style.display = "block";
  });
}

type StackId = string; // rectangle x,y,w,h e.g. "12,34,45,67"
function getStackId(newProps: ObjectTempProps | ObjectState, object: ObjectState): StackId {
  return [newProps.x, newProps.y, object.width, object.height].join(",");
}
const selectionRectangleDiv = document.getElementById("selectionRectangleDiv") as HTMLDivElement;
function renderSelectionRectangle() {
  if (draggingMode === DragMode.RECTANGLE_SELECT) {
    let x = rectangleSelectStartX;
    let y = rectangleSelectStartY;
    let width  = rectangleSelectEndX - rectangleSelectStartX;
    let height = rectangleSelectEndY - rectangleSelectStartY;
    let borderWidth = parseInt(selectionRectangleDiv.style.borderWidth);
    if (width >= 0) {
      width -= 2 * borderWidth;
    } else {
      width *= -1;
      x -= width;
    }
    if (height >= 0) {
      height -= 2 * borderWidth;
    } else {
      height *= -1;
      y -= height;
    }
    if (height <= 0) height = 1;
    if (width  <= 0) width  = 1;
    selectionRectangleDiv.style.left = (tableDiv.offsetLeft + x) + "px";
    selectionRectangleDiv.style.top  = (tableDiv.offsetTop  + y) + "px";
    selectionRectangleDiv.style.width  = width  + "px";
    selectionRectangleDiv.style.height = height + "px";
    selectionRectangleDiv.style.display = "block";
  } else {
    selectionRectangleDiv.style.display = "none";
  }
}
const numberBufferDiv = document.getElementById("numberBufferDiv") as HTMLDivElement;
function renderNumberBuffer() {
  if (numberTypingBuffer.length !== 0) {
    numberBufferDiv.textContent = numberTypingBuffer;
    numberBufferDiv.style.display = "block";
  } else {
    numberBufferDiv.style.display = "none";
  }
}
function resizeTableToFitEverything() {
  // don't shrink the scrollable area while we're holding the thing that causes it to shrink
  if (draggingMode === DragMode.MOVE_SELECTION) return;
  // at least this minimum size
  let maxX = 800;
  let maxY = 800;
  let padding = 8;
  for (let id in objectsById) {
    let object = objectsById[id];
    let x = object.x + object.width  + padding;
    let y = object.y + object.height + padding;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  tableDiv.style.width  = maxX + "px";
  tableDiv.style.height = maxY + "px";
}

function snapToSnapZones(object: ObjectState, newProps: ObjectTempProps): boolean {
  objectsWithSnapZones.sort(compareZ);
  for (let i = objectsWithSnapZones.length - 1; i >= 0; i--) {
    let containerObject = objectsWithSnapZones[i];
    let containerProps = selectedObjectIdToNewProps[containerObject.id] ?? containerObject;
    for (let j = 0; j < containerObject.snapZones.length; j++) {
      let snapZoneDefinition = containerObject.snapZones[j];
      let snapZoneX      = snapZoneDefinition.x          ?? 0;
      let snapZoneY      = snapZoneDefinition.y          ?? 0;
      let snapZoneWidth  = snapZoneDefinition.width      ?? containerObject.width;
      let snapZoneHeight = snapZoneDefinition.height     ?? containerObject.height;
      let cellWidth      = snapZoneDefinition.cellWidth  ?? snapZoneWidth;
      let cellHeight     = snapZoneDefinition.cellHeight ?? snapZoneHeight;
      if (cellWidth  < object.width)  continue; // doesn't fit in the zone
      if (cellHeight < object.height) continue; // doesn't fit in the zone
      if (newProps.x >= containerProps.x + snapZoneX + snapZoneWidth)  continue; // way off right
      if (newProps.y >= containerProps.y + snapZoneY + snapZoneHeight) continue; // way off bottom
      if (newProps.x + object.width  <= containerProps.x + snapZoneX)  continue; // way off left
      if (newProps.y + object.height <= containerProps.y + snapZoneY)  continue; // way off top
      // this is the zone for us
      let relativeCenterX = newProps.x + object.width /2 - (containerProps.x + snapZoneX);
      let relativeCenterY = newProps.y + object.height/2 - (containerProps.y + snapZoneY);
      let modX = euclideanMod(relativeCenterX, cellWidth);
      let modY = euclideanMod(relativeCenterY, cellHeight);
      let divX = Math.floor(relativeCenterX / cellWidth);
      let divY = Math.floor(relativeCenterY / cellHeight);
      let newModX = clamp(modX, object.width /2, cellWidth  - object.width /2);
      let newModY = clamp(modY, object.height/2, cellHeight - object.height/2);

      let inBoundsX = 0 <= relativeCenterX && relativeCenterX < snapZoneWidth;
      let inBoundsY = 0 <= relativeCenterY && relativeCenterY < snapZoneHeight;
      if (!inBoundsX && !inBoundsY) {
        // on an outside corner. we need to pick an edge to rub.
        if (Math.abs(modX - newModX) > Math.abs(modY - newModY)) {
          // x is further off
          inBoundsX = true;
        } else {
          // y is further off
          inBoundsY = true;
        }
      }
      if (inBoundsY) newProps.x = divX * cellWidth  + newModX - object.width /2 + containerProps.x + snapZoneX;
      if (inBoundsX) newProps.y = divY * cellHeight + newModY - object.height/2 + containerProps.y + snapZoneY;
      return true;
    }
  }
  return false;
}

function getObjects(): ObjectState[] {
  let objects = [];
  for (let objectId in objectsById) {
    objects.push(objectsById[objectId]);
  }
  return objects;
}
function compareZ(a: {z: number}, b: {z: number}) {
  return operatorCompare(a.z, b.z);
}

export function makeAMove(move: MakeAMoveArgs, shouldRender: boolean) {
  let objectsToRender: ObjectState[] = [];
  let i = 0;
  let userId = move[i++];
  if (userId === getMyUserId()) return;
  while (i < move.length) {
    let actionCode = move[i++];
    switch (actionCode) {
      case "c": { // create
        let object = consumeObjectProps(move, i);
        i += objectPropCount;
        registerObject(object);
        if (shouldRender) objectsToRender.push(object);
        break;
      }
      case "d": {
        let object = consumeObjectProps(move, i);
        i += objectPropCount;
        deleteObject(object.id);
        break;
      }
      case "m": { // move
        let object = objectsById[move[i++]];
        move[i++]; // fromX
        move[i++]; // fromY
        move[i++]; // fromZ
        move[i++]; // fromFaceIndex
        let toX         = move[i++];
        let toY         = move[i++];
        let toZ         = move[i++];
        let toFaceIndex = move[i++];
        object.x = toX;
        object.y = toY;
        object.z = toZ;
        object.faceIndex = toFaceIndex;
        let newProps = selectedObjectIdToNewProps[object.id];
        if (newProps != null) {
          newProps.x = toX;
          newProps.y = toY;
          newProps.z = toZ;
          newProps.faceIndex = toFaceIndex;
        }
        if (shouldRender) objectsToRender.push(object);
        break;
      }
      default: programmerError();
    }
  }

  if (shouldRender) {
    objectsToRender.forEach(object => render(object, true));
    renderOrder();
    resizeTableToFitEverything();
    fixFloatingThingZ();
  }
  pushChangeToHistory(move);
}

function generateRandomId(): ObjectId {
  let result = "";
  for (let i = 0; i < 16; i++) {
    let n = Math.floor(Math.random() * 16);
    let c = n.toString(16);
    result += c;
  }
  return result;
}
function getObjectDiv(id: ObjectId) {
  return document.getElementById("object-" + id) as HTMLDivElement;
}
function getStackHeightDiv(id: ObjectId) {
  return document.getElementById("stackHeight-" + id) as HTMLDivElement;
}
function getBackgroundDiv(id: ObjectId) {
  return document.getElementById("background-" + id) as HTMLDivElement | null;
}

// Done defining everything.
setScreenMode(ScreenMode.LOGIN);
