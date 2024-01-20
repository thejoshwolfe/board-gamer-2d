
let roomCode: string | null = null;
let myUser: {
  id: string,
  userName: string,
  role: string,
} | null = null;

const SCREEN_MODE_DISCONNECTED = 0;
const SCREEN_MODE_LOGIN = 1;
const SCREEN_MODE_WAITING_FOR_SERVER_CONNECT = 2;
const SCREEN_MODE_WAITING_FOR_CREATE_ROOM = 3;
const SCREEN_MODE_WAITING_FOR_ROOM_CODE_CONFIRMATION = 4;
const SCREEN_MODE_PLAY = 5;
let screenMode = SCREEN_MODE_LOGIN;

const createRoomButton = document.getElementById("createRoomButton") as HTMLInputElement;
createRoomButton.addEventListener("click", function() {
  roomCode = null;
  connectToServer();
});
const roomCodeTextbox = document.getElementById("roomCodeTextbox") as HTMLInputElement;
roomCodeTextbox.addEventListener("keydown", function(event) {
  event.stopPropagation();
  if (event.keyCode === 13) {
    setTimeout(submitRoomCode, 0);
  } else {
    setTimeout(function() {
      var value = roomCodeTextbox.value;
      var canonicalValue = value.toUpperCase();
      if (value === canonicalValue) return;
      var selectionStart = roomCodeTextbox.selectionStart;
      var selectionEnd = roomCodeTextbox.selectionEnd;
      roomCodeTextbox.value = canonicalValue;
      roomCodeTextbox.selectionStart = selectionStart;
      roomCodeTextbox.selectionEnd = selectionEnd;
    }, 0);
  }
});
const joinRoomButton = document.getElementById("joinRoomButton") as HTMLInputElement;
joinRoomButton.addEventListener("click", submitRoomCode);
function submitRoomCode() {
  roomCode = roomCodeTextbox.value;
  connectToServer();
}

const loadingMessageDiv = document.getElementById("loadingMessageDiv") as HTMLDivElement;
function setScreenMode(newMode) {
  screenMode = newMode;
  var loadingMessage = null;
  var activeDivId = (function() {
    switch (screenMode) {
      case SCREEN_MODE_PLAY: return "roomDiv";
      case SCREEN_MODE_LOGIN: return "loginDiv";
      case SCREEN_MODE_DISCONNECTED:
        loadingMessage = "Disconnected...";
        return "loadingDiv";
      case SCREEN_MODE_WAITING_FOR_SERVER_CONNECT:
        loadingMessage = "Trying to reach the server...";
        return "loadingDiv";
      case SCREEN_MODE_WAITING_FOR_CREATE_ROOM:
        loadingMessage = "Waiting for a new room...";
        return "loadingDiv";
      case SCREEN_MODE_WAITING_FOR_ROOM_CODE_CONFIRMATION:
        loadingMessage = "Checking room code...";
        return "loadingDiv";
      default: throw asdf;
    }
  })();
  ["roomDiv", "loginDiv", "loadingDiv"].forEach(function(divId) {
    setDivVisible(document.getElementById(divId) as HTMLDivElement, divId === activeDivId);
  });
  if (activeDivId === "loginDiv") roomCodeTextbox.focus();
  loadingMessageDiv.textContent = loadingMessage != null ? loadingMessage : "Please wait...";
}

const tableDiv = document.getElementById("tableDiv") as HTMLDivElement;
const roomCodeSpan = document.getElementById("roomCodeSpan") as HTMLSpanElement;

var usersById = {};

var imageUrlToSize = {
  //"face1.png": {width: 100, height: 200},
};

var gameDefinition;
var database;
var databaseById;
var objectsById;
var objectsWithSnapZones; // cache
var hiderContainers; // cache
var changeHistory;
var futureChanges;
function initGame(_database, game, history) {
  database = _database;
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
  for (var i = 0; i < gameDefinition.objects.length; i++) {
    var rawDefinition = gameDefinition.objects[i];
    var id = rawDefinition.id;
    if (id == null) throw new Error("game object has no id");

    var object = makeObject(id, rawDefinition.prototype);
    object.x = rawDefinition.x;
    object.y = rawDefinition.y;
    object.z = i;
    object.faceIndex = rawDefinition.faceIndex || 0;
    object.locked = !!rawDefinition.locked;
    registerObject(object);
  }
  fixFloatingThingZ();

  // replay history
  history.forEach(function(move) {
    makeAMove(move, false);
  });

  roomCodeSpan.textContent = roomCode;

  checkForDoneLoading();
}
function resolveFace(face) {
  if (face === "front") return 0;
  if (face === "back") return 1;
  return face;
}
function parseFacePath(path) {
  let splitIndex = path.indexOf("#");
  if (splitIndex === -1) {
    return {url:path};
  }
  let url = path.substr(0, splitIndex);
  let cropInfo = path.substr(splitIndex + 1).split(",");
  if (cropInfo.length !== 4) throw new Error("malformed url: " + path);
  let x = parseInt(cropInfo[0]);
  let y = parseInt(cropInfo[1]);
  let width = parseInt(cropInfo[2]);
  let height = parseInt(cropInfo[3]);
  if (isNaN(x - y - width - height)) throw new Error("malformed url: " + path);
  return {url, x, y, width, height};
}
const LOADING = "<loading>";
function preloadImagePath(path) {
  let {url} = parseFacePath(path);
  let size = imageUrlToSize[url];
  if (size != null) return; // already loaded or loading.
  imageUrlToSize[url] = LOADING;
  // Let the host environment cache and deduplicate these.
  var img = new Image();
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
  getObjects().forEach(object => render(object));
  renderOrder();
  resizeTableToFitEverything();
  fixFloatingThingZ();
}
function makeObject(id, prototypeId) {
  // TODO: hash lookup
  var objectDefinition = databaseById[prototypeId];
  if (objectDefinition == null) throw new Error("prototypeId not found: " + prototypeId);
  return {
    id: id,
    prototype: prototypeId,
    temporary: false,
    x: null,
    y: null,
    z: null,
    faceIndex: null,
    locked: null,
    width:  objectDefinition.width  || error(),
    height: objectDefinition.height || error(),
    faces: objectDefinition.faces || [],
    snapZones: objectDefinition.snapZones || [],
    visionWhitelist: objectDefinition.visionWhitelist || [],
    hideFaces: objectDefinition.hideFaces || [],
    backgroundColor: objectDefinition.backgroundColor || "",
    labelPlayerName: objectDefinition.labelPlayerName || "",
  };
  function error() {
    throw new Error();
  }
}
function registerObject(object) {
  objectsById[object.id] = object;
  if (object.snapZones.length > 0) objectsWithSnapZones.push(object);
  if (object.visionWhitelist.length > 0) hiderContainers.push(object);

  tableDiv.insertAdjacentHTML("beforeend",
    '<div id="object-'+object.id+'" data-id="'+object.id+'" class="gameObject" style="display:none;">' +
      '<div id="stackHeight-'+object.id+'" class="stackHeight" style="display:none;"></div>' +
    '</div>'
  );
  var objectDiv = getObjectDiv(object.id);
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
function deleteObject(id) {
  if (hoverObject === objectsById[id]) hoverObject = null;
  delete objectsById[id];
  deleteObjectFromArray(objectsWithSnapZones, id);
  deleteObjectFromArray(hiderContainers, id);
  delete selectedObjectIdToNewProps[id];
  deleteDiv(getObjectDiv(id));
  var backgroundDiv = getBackgroundDiv(id);
  if (backgroundDiv != null) deleteDiv(backgroundDiv);
}
function deleteObjectFromArray(array, id) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].id === id) {
      array.splice(i, 1);
      break;
    }
  }
}
function deleteDiv(div) {
  if (hoverDiv === div) hoverDiv = null;
  tableDiv.removeChild(div);
}

function deleteTableAndEverything() {
  closeDialog();
  tableDiv.innerHTML = "";
  database = null;
  databaseById = null;
  gameDefinition = null;
  objectsById = null;
  usersById = {};
  selectedObjectIdToNewProps = {};
  consumeNumberModifier();
  // leave the image cache alone
}
function findMaxZ(excludingSelection) {
  var maxZ = null;
  getObjects().forEach(function(object) {
    if (excludingSelection != null && object.id in excludingSelection) return;
    var newProps = selectedObjectIdToNewProps[object.id];
    if (newProps == null) newProps = object;
    if (maxZ == null || newProps.z > maxZ) maxZ = newProps.z;
  });
  return maxZ;
}
function fixFloatingThingZ() {
  renderExaminingObjects();
  var z = findMaxZ(examiningObjectsById) + Object.keys(examiningObjectsById).length;
  z++;
  hiderContainers.forEach(function(object) {
    var objectDiv = getObjectDiv(object.id);
    if (object.visionWhitelist.indexOf(myUser.role) === -1) {
      // blocked
      objectDiv.style.zIndex = z++;
    } else {
      // see it
      objectDiv.style.zIndex = object.z;
    }
  });
  topRightDiv.style.zIndex = z++;
  helpDiv.style.zIndex = z++;
  closetDiv.style.zIndex = z++;
  modalMaskDiv.style.zIndex = z++;
  editUserDiv.style.zIndex = z++;
}

var DRAG_NONE = 0;
var DRAG_RECTANGLE_SELECT = 1;
var DRAG_MOVE_SELECTION = 2;
var draggingMode = DRAG_NONE;

var rectangleSelectStartX;
var rectangleSelectStartY;
var rectangleSelectEndX;
var rectangleSelectEndY;
var selectedObjectIdToNewProps = {};

var EXAMINE_NONE = 0;
var EXAMINE_SINGLE = 1;
var EXAMINE_MULTI = 2;
var examiningMode = EXAMINE_NONE;
var examiningObjectsById = {};

var hoverObject;
var hoverDiv;
var lastMouseDragX;
var lastMouseDragY;

var accordionMouseStartX = null;
var accordionObjectStartX = null;
var isGKeyDown = false;

function onObjectMouseDown(event) {
  if (event.button !== 0) return;
  if (examiningMode !== EXAMINE_NONE) return;
  var objectDiv = this;
  var object = objectsById[objectDiv.dataset.id];
  if (object.locked && !moveLockedObjectsModeCheckbox.checked) return; // click thee behind me, satan
  event.preventDefault();
  event.stopPropagation();

  // select
  if (selectedObjectIdToNewProps[object.id] == null) {
    // make a selection
    var numberModifier = consumeNumberModifier();
    if (numberModifier == null) numberModifier = 1;
    if (numberModifier === 1) {
      setSelectedObjects([object]);
    } else {
      var stackId = getStackId(object, object);
      var stackOfObjects = getObjects().filter(function(object) { return getStackId(object, object) === stackId; });
      stackOfObjects.sort(compareZ);
      // we can be pretty sure the object we're clicking is the top.
      if (numberModifier < stackOfObjects.length) {
        stackOfObjects.splice(0, stackOfObjects.length - numberModifier);
      }
      setSelectedObjects(stackOfObjects);
    }
  }

  // begin drag
  draggingMode = DRAG_MOVE_SELECTION;
  lastMouseDragX = eventToMouseX(event, tableDiv);
  lastMouseDragY = eventToMouseY(event, tableDiv);
  if (isGKeyDown) startAccordion();

  bringSelectionToTop();
}
function onObjectMouseMove(event) {
  if (draggingMode != DRAG_NONE) return;
  var objectDiv = this;
  var object = objectsById[objectDiv.dataset.id];
  if (object.locked && !moveLockedObjectsModeCheckbox.checked) return;
  setHoverObject(object);
}
function onObjectMouseOut(event) {
  var objectDiv = this;
  var object = objectsById[objectDiv.dataset.id];
  if (hoverObject === object) {
    setHoverObject(null);
  }
}

function bringSelectionToTop() {
  // bring selection to top
  // effectively do a stable sort.
  var selection = selectedObjectIdToNewProps;
  var newPropses = [];
  for (var id in selection) {
    newPropses.push(selection[id]);
  }
  newPropses.sort(compareZ);
  var z = findMaxZ(selection);
  newPropses.forEach(function(newProps, i) {
    newProps.z = z + i + 1;
  });
  renderAndMaybeCommitSelection(selection, true);
  fixFloatingThingZ();
}

tableDiv.addEventListener("mousedown", function(event) {
  if (event.button !== 0) return;
  // clicking the table
  event.preventDefault();
  if (examiningMode !== EXAMINE_NONE) return;
  draggingMode = DRAG_RECTANGLE_SELECT;
  rectangleSelectStartX = eventToMouseX(event, tableDiv);
  rectangleSelectStartY = eventToMouseY(event, tableDiv);
  setSelectedObjects([]);
});

document.addEventListener("mousemove", function(event) {
  var x = eventToMouseX(event, tableDiv);
  var y = eventToMouseY(event, tableDiv);
  if (draggingMode === DRAG_RECTANGLE_SELECT) {
    rectangleSelectEndX = x;
    rectangleSelectEndY = y;
    renderSelectionRectangle();
    (function() {
      var minX = rectangleSelectStartX;
      var minY = rectangleSelectStartY;
      var maxX = rectangleSelectEndX;
      var maxY = rectangleSelectEndY;
      if (minX > maxX) { var tmp = maxX; maxX = minX; minX = tmp; }
      if (minY > maxY) { var tmp = maxY; maxY = minY; minY = tmp; }
      var newSelectedObjects = [];
      getObjects().forEach(function(object) {
        if (object.locked && !moveLockedObjectsModeCheckbox.checked) return;
        if (object.x > maxX) return;
        if (object.y > maxY) return;
        if (object.x + object.width  < minX) return;
        if (object.y + object.height < minY) return;
        newSelectedObjects.push(object);
      });
      setSelectedObjects(newSelectedObjects);
    })();
  } else if (draggingMode === DRAG_MOVE_SELECTION) {
    if (accordionMouseStartX != null) {
      // accordion drag
      var dx = x - accordionMouseStartX;
      var objects = [];
      for (var id in selectedObjectIdToNewProps) {
        objects.push(objectsById[id]);
      }
      objects.sort(compareZ);
      objects.forEach(function(object, i) {
        var newProps = selectedObjectIdToNewProps[object.id];
        var factor = i === objects.length - 1 ? 1 : i / (objects.length - 1);
        newProps.x = Math.round(accordionObjectStartX + dx * factor);
        render(object);
      });
    } else {
      // normal drag
      var dx = x - lastMouseDragX;
      var dy = y - lastMouseDragY;
      Object.keys(selectedObjectIdToNewProps).forEach(function(id) {
        var object = objectsById[id];
        var newProps = selectedObjectIdToNewProps[id];
        newProps.x = Math.round(newProps.x + dx);
        newProps.y = Math.round(newProps.y + dy);
        render(object);
      });
    }
    renderOrder();
    resizeTableToFitEverything();
    lastMouseDragX = x;
    lastMouseDragY = y;
  }
});
document.addEventListener("mouseup", function(event) {
  if (draggingMode === DRAG_RECTANGLE_SELECT) {
    draggingMode = DRAG_NONE;
    renderSelectionRectangle();
  } else if (draggingMode === DRAG_MOVE_SELECTION) {
    draggingMode = DRAG_NONE;
    // snap to grid
    for (var id in selectedObjectIdToNewProps) {
      var object = objectsById[id];
      var newProps = selectedObjectIdToNewProps[id];
      if (snapToSnapZones(object, newProps)) {
        render(object, true);
      }
    }
    commitSelection(selectedObjectIdToNewProps);
    resizeTableToFitEverything();
    renderOrder();
  }
});

function setHoverObject(object) {
  if (hoverObject == object) return;
  hoverObject = object;
  setHoverDiv(hoverObject != null ? getObjectDiv(hoverObject.id) : null);
}
function setHoverDiv(div) {
  if (hoverDiv == div) return;
  if (hoverDiv != null) hoverDiv.classList.remove("hoverSelect");
  hoverDiv = div;
  if (hoverDiv != null) hoverDiv.classList.add("hoverSelect");
}
function setSelectedObjects(objects) {
  for (var id in selectedObjectIdToNewProps) {
    var objectDiv = getObjectDiv(id);
    objectDiv.classList.remove("selected");
  }
  selectedObjectIdToNewProps = {};
  objects.forEach(function(object) {
    selectedObjectIdToNewProps[object.id] = newPropsForObject(object);
  });
  for (var id in selectedObjectIdToNewProps) {
    var objectDiv = getObjectDiv(id);
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
function newPropsForObject(object) {
  return {
    x: object.x,
    y: object.y,
    z: object.z,
    faceIndex: object.faceIndex,
  };
}
function getEffectiveSelection(objects) {
  // if you make changes, call renderAndMaybeCommitSelection
  if (Object.keys(selectedObjectIdToNewProps).length > 0) return selectedObjectIdToNewProps;
  if (hoverObject != null) {
    var effectiveSelection = {};
    effectiveSelection[hoverObject.id] = newPropsForObject(hoverObject);
    return effectiveSelection;
  }
  return {};
}
function renderAndMaybeCommitSelection(selection, isAnimated) {
  var objectsToRender = [];
  // render
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
    if (!(object.x === newProps.x &&
          object.y === newProps.y &&
          object.z === newProps.z &&
          object.faceIndex === newProps.faceIndex)) {
      objectsToRender.push(object);
    }
  }
  if (draggingMode === DRAG_NONE) {
    // if we're dragging, don't commit yet
    commitSelection(selection);
  }
  // now that we've possibly committed a temporary selection, we can render.
  objectsToRender.forEach(object => render(object, isAnimated));
  renderOrder();
  resizeTableToFitEverything();

  // it's too late to use this
  consumeNumberModifier();
}
function commitSelection(selection) {
  var move = [];
  move.push(myUser.id);
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
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
  var message = {
    cmd: "makeAMove",
    args: move,
  };
  sendMessage(message);
  pushChangeToHistory(move);
}
function pushObjectProps(move, object) {
  move.push(
    object.id,
    object.prototype,
    object.x,
    object.y,
    object.z,
    object.faceIndex);
}
var objectPropCount = 6;
function consumeObjectProps(move, i) {
  var    id              = move[i++];
  var    prototypeId     = move[i++];
  var object = makeObject(id, prototypeId);
  object.x               = move[i++];
  object.y               = move[i++];
  object.z               = move[i++];
  object.faceIndex       = move[i++];
  return object;
}

var SHIFT = 1;
var CTRL = 2;
var ALT = 4;
function getModifierMask(event) {
  return (
    (event.shiftKey ? SHIFT : 0) |
    (event.ctrlKey ? CTRL : 0) |
    (event.altKey ? ALT : 0)
  );
}
document.addEventListener("keydown", function(event) {
  if (dialogIsOpen) {
    if (event.keyCode === 27) closeDialog();
    return;
  }
  var modifierMask = getModifierMask(event);
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
      if (modifierMask === 0 && numberTypingBuffer.length > 0) { consumeNumberModifier(); break; }
      if (modifierMask === 0 && draggingMode === DRAG_MOVE_SELECTION) { cancelMove(); break; }
      if (modifierMask === 0 && draggingMode === DRAG_NONE)           { setSelectedObjects([]); break; }
      return;
    case 46: // Delete
      if (modifierMask === 0) { deleteSelection(); break; }
      return;
    case "Z".charCodeAt(0):
      if (draggingMode === DRAG_NONE && modifierMask === CTRL)         { undo(); break; }
      if (draggingMode === DRAG_NONE && modifierMask === (CTRL|SHIFT)) { redo(); break; }
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
      var numberValue = event.keyCode < 96 ? event.keyCode - 48 : event.keyCode - 96;
      if (modifierMask === 0) { typeNumber(numberValue); break; }
      return;

    default: return;
  }
  event.preventDefault();
});
document.addEventListener("keyup", function(event) {
  var modifierMask = getModifierMask(event);
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
  if (draggingMode !== DRAG_MOVE_SELECTION) return;
  accordionMouseStartX = lastMouseDragX;
  for (var id in selectedObjectIdToNewProps) {
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
  var selection = getEffectiveSelection();
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
    newProps.faceIndex += 1;
    if (object.faces.length === newProps.faceIndex) {
      newProps.faceIndex = 0;
    }
  }
  renderAndMaybeCommitSelection(selection, false);
  renderOrder();
}
function rollSelection() {
  var selection = getEffectiveSelection();
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
    newProps.faceIndex = Math.floor(Math.random() * object.faces.length);
  }
  renderAndMaybeCommitSelection(selection, false);
  renderOrder();
}
function cancelMove() {
  var selection = selectedObjectIdToNewProps;
  for (var id in selection) {
    var object = objectsById[id];
    if (object.temporary) {
      deleteObject(id);
    } else {
      var newProps = selection[id];
      newProps.x = object.x;
      newProps.y = object.y;
      newProps.z = object.z;
      newProps.faceIndex = object.faceIndex;
      render(object, true);
    }
  }
  draggingMode = DRAG_NONE;
  renderOrder();
  resizeTableToFitEverything();
  fixFloatingThingZ();
}
function deleteSelection() {
  var selection = getEffectiveSelection();
  var objects = [];
  for (var id in selection) {
    objects.push(objectsById[id]);
  }
  var partialDeletion = false;
  var numberModifier = consumeNumberModifier();
  if (numberModifier != null && numberModifier < objects.length) {
    // only delete the top N objects
    objects.sort(compareZ);
    objects.splice(0, objects.length - numberModifier);
    partialDeletion = true;
  }

  var move = [];
  objects.forEach(function(object) {
    if (!object.temporary) {
      move.push("d"); // delete
      pushObjectProps(move, object);
    }
    deleteObject(object.id);
  });
  if (move.length > 0) {
    move.unshift(myUser.id);
    sendMessage({cmd:"makeAMove", args:move});
    pushChangeToHistory(move);
  }

  if (draggingMode === DRAG_MOVE_SELECTION && !partialDeletion) draggingMode = DRAG_NONE;
  renderOrder();
  resizeTableToFitEverything();
  fixFloatingThingZ();
}
function shuffleSelection() {
  var selection;
  if (Object.keys(selectedObjectIdToNewProps).length > 0) {
    // real selection
    selection = selectedObjectIdToNewProps;
  } else if (hoverObject != null) {
    // select all objects we're hovering over in this stack
    var stackId = getStackId(hoverObject, hoverObject);
    selection = {};
    getObjects().forEach(function(object) {
      if (stackId !== getStackId(object, object)) return;
      selection[object.id] = newPropsForObject(object);
    });
  } else {
    // no selection
    return;
  }

  var newPropsArray = [];
  for (var id in selection) {
    newPropsArray.push(selection[id]);
  }
  for (var i = 0; i < newPropsArray.length; i++) {
    var otherIndex = Math.floor(Math.random() * (newPropsArray.length - i)) + i;
    var tempX = newPropsArray[i].x;
    var tempY = newPropsArray[i].y;
    var tempZ = newPropsArray[i].z;
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
  var selection = getEffectiveSelection();
  var selectionLength = Object.keys(selection).length;
  if (selectionLength <= 1) return;
  // find the weighted center (average location)
  var totalX = 0;
  var totalY = 0;
  for (var id in selection) {
    var newProps = selection[id];
    totalX += newProps.x;
    totalY += newProps.y;
  }
  // who is closest to the weighted center?
  var averageX = totalX / selectionLength;
  var averageY = totalY / selectionLength;
  var medianNewProps = null;
  var shortestDistanceSquared = Infinity;
  for (var id in selection) {
    var newProps = selection[id];
    var dx = newProps.x - averageX;
    var dy = newProps.y - averageY;
    var distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < shortestDistanceSquared) {
      shortestDistanceSquared = distanceSquared;
      medianNewProps = newProps;
    }
  }
  // everybody move to the center
  for (var id in selection) {
    var newProps = selection[id];
    newProps.x = medianNewProps.x;
    newProps.y = medianNewProps.y;
  }
  renderAndMaybeCommitSelection(selection, true);
  renderOrder();
  resizeTableToFitEverything();
}
function examineSingle() {
  if (examiningMode === EXAMINE_SINGLE) return; // ignore key repeat
  unexamine();
  examiningMode = EXAMINE_SINGLE;
  examiningObjectsById = {};
  if (hoverObject == null) return;
  // ignore the newProps in selectedObjectIdToNewProps, because it doesn't really matter
  examiningObjectsById[hoverObject.id] = newPropsForObject(hoverObject);
  renderExaminingObjects();
}
function examineMulti() {
  if (examiningMode === EXAMINE_MULTI) return;
  unexamine();
  examiningMode = EXAMINE_MULTI;

  var selection;
  if (Object.keys(selectedObjectIdToNewProps).length > 0) {
    // real selection
    selection = selectedObjectIdToNewProps;
  } else if (hoverObject != null) {
    // choose all objects overlapping the hover object
    var hoverX = hoverObject.x;
    var hoverY = hoverObject.y;
    var hoverWidth  = hoverObject.width;
    var hoverHeight = hoverObject.height;
    selection = {};
    getObjects().forEach(function(object) {
      if (object.locked && !moveLockedObjectsModeCheckbox.checked) return; // don't look at me
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
  if (examiningMode === EXAMINE_NONE) return;
  examiningMode = EXAMINE_NONE;
  var selection = examiningObjectsById;
  examiningObjectsById = {};
  for (var id in selection) {
    render(objectsById[id], true);
  }
  renderOrder();
}

var numberTypingBuffer = "";
function typeNumber(numberValue) {
  numberTypingBuffer += numberValue;
  renderNumberBuffer();
}
function consumeNumberModifier() {
  if (numberTypingBuffer.length === 0) return null;
  var result = parseInt(numberTypingBuffer, 10);
  numberTypingBuffer = "";
  renderNumberBuffer();
  return result;
}
function clearNumberBuffer() {
  numberTypingBuffer = "";
  renderNumberBuffer();
}

var isHelpShown = true;
var isHelpMouseIn = false;
function toggleHelp() {
  isHelpShown = !isHelpShown;
  renderHelp();
}
const topRightDiv = document.getElementById("topRightDiv") as HTMLDivElement;
const helpDiv = document.getElementById("helpDiv") as HTMLDivElement;
helpDiv.addEventListener("mousemove", function() {
  if (draggingMode !== DRAG_NONE) return;
  isHelpMouseIn = true;
  renderHelp();
});
helpDiv.addEventListener("mouseout", function() {
  isHelpMouseIn = false;
  renderHelp();
});
function renderHelp() {
  if (isHelpShown || isHelpMouseIn) {
    helpDiv.classList.add("helpExpanded");
  } else {
    helpDiv.classList.remove("helpExpanded");
  }
}

var showCloset = false;

const closetDiv = document.getElementById("closetDiv") as HTMLDivElement;
const closetShowHideButton = document.getElementById("closetShowHideButton") as HTMLParagraphElement;
const closetUl = document.getElementById("closetUl") as HTMLUListElement;
closetShowHideButton.addEventListener("click", function(event) {
  event.preventDefault();
  if (event.button !== 0) return;
  event.stopPropagation();
  if (showCloset) {
    closetUl.innerHTML = "";
    showCloset = false;
    return;
  }
  showCloset = true;
  renderCloset();
});
function renderCloset() {
  closetUl.innerHTML = database.filter(function(closetObject) {
    // TODO: show groups with items
    return closetObject.closetName != null;
  }).map(function(closetObject) {
    var id        = closetObject.id;
    var name      = closetObject.closetName;
    var thumbnail = closetObject.thumbnail       || closetObject.faces[0];
    var width     = closetObject.thumbnailWidth  || 25;
    var height    = closetObject.thumbnailHeight || 25;
    return '<li data-id="'+id+'"><img src="'+thumbnail+'" width='+width+' height='+height+'>'+name+'</li>';
  }).join("");
  var fakeArray = closetUl.getElementsByTagName("li");
  for (var i = 0; i < fakeArray.length; i++) {
    var li = fakeArray[i];
    li.addEventListener("mousedown", onClosetObjectMouseDown);
    li.addEventListener("mousemove", onClosetObjectMouseMove);
    li.addEventListener("mouseout",  onClosetObjectMouseOut);
  }
}
function onClosetObjectMouseDown(event) {
  if (event.button !== 0) return;
  if (examiningMode !== EXAMINE_NONE) return;
  event.preventDefault();
  event.stopPropagation();
  var x = this.getBoundingClientRect().left - tableDiv.getBoundingClientRect().left;
  var y = this.getBoundingClientRect().top  - tableDiv.getBoundingClientRect().top;
  var closetId = this.dataset.id;
  var closetObject = databaseById[closetId];
  var prototypeIds = closetObject.items;
  if (prototypeIds == null) {
    prototypeIds = [closetObject.id];
  }

  // create temporary objects
  var numberModifier = consumeNumberModifier();
  if (numberModifier == null) numberModifier = 1;
  var stackOfObjects = [];
  var z = findMaxZ();
  z++;
  for (var i = 0; i < numberModifier; i++) {
    prototypeIds.forEach(function(prototypeId) {
      stackOfObjects.push(makeTemporaryObject(prototypeId, x, y, z++));
    });
  }
  setSelectedObjects(stackOfObjects);

  // begin drag
  draggingMode = DRAG_MOVE_SELECTION;
  lastMouseDragX = eventToMouseX(event, tableDiv);
  lastMouseDragY = eventToMouseY(event, tableDiv);

  // bring selection to top
  bringSelectionToTop();
}
function onClosetObjectMouseMove(event) {
  if (draggingMode != DRAG_NONE) return;
  setHoverDiv(this);
}
function onClosetObjectMouseOut(event) {
  if (hoverDiv === this) {
    setHoverDiv(null);
  }
}

function makeTemporaryObject(prototypeId, x, y, z) {
  var id = generateRandomId();
  var object = makeObject(id, prototypeId);
  object.temporary = true;
  object.x = x;
  object.y = y;
  object.z = z;
  object.faceIndex = 0;
  object.locked = false;
  registerObject(object);
  render(object, false);
  return object;
}

function undo() { undoOrRedo(changeHistory, futureChanges); }
function redo() { undoOrRedo(futureChanges, changeHistory); }
function undoOrRedo(thePast, theFuture) {
  consumeNumberModifier();
  if (thePast.length === 0) return;
  var newMove = reverseChange(thePast.pop());
  sendMessage({cmd:"makeAMove", args:newMove});
  theFuture.push(newMove);
}
function reverseChange(move) {
  var newMove = [myUser.id];
  var i = 0;
  move[i++]; // userId
  while (i < move.length) {
    var actionCode = move[i++];
    switch (actionCode) {
      case "c": // create -> delete
        var object = consumeObjectProps(move, i);
        i += objectPropCount;
        newMove.push("d"); // delete
        pushObjectProps(newMove, object);
        deleteObject(object.id);
        break;
      case "d": // delete -> create
        var object = consumeObjectProps(move, i);
        i += objectPropCount;
        newMove.push("c"); // create
        pushObjectProps(newMove, object);
        registerObject(object);
        render(object, true);
        break;
      case "m": // move -> move
        var object = objectsById[move[i++]];
        var fromX         =      move[i++];
        var fromY         =      move[i++];
        var fromZ         =      move[i++];
        var fromFaceIndex =      move[i++];
        var   toX         =      move[i++];
        var   toY         =      move[i++];
        var   toZ         =      move[i++];
        var   toFaceIndex =      move[i++];
        object.x         = fromX;
        object.y         = fromY;
        object.z         = fromZ;
        object.faceIndex = fromFaceIndex;
        var newProps = selectedObjectIdToNewProps[object.id];
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
      default: throw asdf();
    }
  }
  renderOrder();
  resizeTableToFitEverything();

  return newMove;
}
function pushChangeToHistory(change) {
  changeHistory.push(change);
  futureChanges = [];
}

function eventToMouseX(event, div) { return event.clientX - div.getBoundingClientRect().left; }
function eventToMouseY(event, div) { return event.clientY - div.getBoundingClientRect().top; }

const userListUl = document.getElementById("userListUl") as HTMLUListElement;
function renderUserList() {
  var userIds = Object.keys(usersById);
  userIds.sort();
  userListUl.innerHTML = userIds.map(function(userId) {
    return (
      '<li'+(userId === myUser.id ? ' id="myUserNameLi" title="Click to edit your name/role"' : '')+'>' +
        sanitizeHtml(usersById[userId].userName) +
      '</li>');
  }).join("");

  getObjects().forEach(function(object) {
    if (object.labelPlayerName === "") return;
    var userName = null;
    if (object.labelPlayerName === myUser.role) {
      userName = "You";
    } else {
      for (var i = 0; i < userIds.length; i++) {
        if (usersById[userIds[i]].role === object.labelPlayerName) {
          userName = usersById[userIds[i]].userName;
          break;
        }
      }
    }
    var roleName = null;
    for (var i = 0; i < gameDefinition.roles.length; i++) {
      if (gameDefinition.roles[i].id === object.labelPlayerName) {
        roleName = gameDefinition.roles[i].name;
        break;
      }
    }
    var labelText;
    if (userName != null) {
      labelText = userName + " ("+roleName+")";
    } else {
      labelText = roleName;
    }
    var stackHeightDiv = getStackHeightDiv(object.id);
    stackHeightDiv.textContent = labelText;
    stackHeightDiv.style.display = "block";
  });
  const myUserNameLi = document.getElementById("myUserNameLi") as HTMLLIElement;
  myUserNameLi.addEventListener("click", showEditUserDialog);
}
var dialogIsOpen = false;
const modalMaskDiv = document.getElementById("modalMaskDiv") as HTMLDivElement;
modalMaskDiv.addEventListener("mousedown", closeDialog);
const editUserDiv = document.getElementById("editUserDiv") as HTMLDivElement;
function showEditUserDialog() {
  modalMaskDiv.style.display = "block";
  editUserDiv.style.display = "block";

  yourNameTextbox.value = myUser.userName;
  yourRoleDropdown.innerHTML = '<option value="">Spectator</option>' + gameDefinition.roles.map(function(role) {
    return '<option value="'+role.id+'">' + sanitizeHtml(role.name) + '</option>';
  }).join("");
  yourRoleDropdown.value = myUser.role;

  dialogIsOpen = true;
  yourNameTextbox.focus();
  yourNameTextbox.select();
}
function closeDialog() {
  modalMaskDiv.style.display = "none";
  editUserDiv.style.display = "none";
  if (document.activeElement != null) {
    document.activeElement.blur();
  }
  dialogIsOpen = false;
}
const yourNameTextbox = document.getElementById("yourNameTextbox") as HTMLInputElement;
yourNameTextbox.addEventListener("keydown", function(event) {
  event.stopPropagation();
  if (event.keyCode === 13) {
    setTimeout(function() {
      submitYourName();
      closeDialog();
    }, 0);
  } else if (event.keyCode === 27) {
    setTimeout(closeDialog, 0);
  }
});
const submitYourNameButton = document.getElementById("submitYourNameButton") as HTMLInputElement;
submitYourNameButton.addEventListener("click", submitYourName);
function submitYourName() {
  var newName = yourNameTextbox.value;
  if (newName && newName !== myUser.userName) {
    sendMessage({
      cmd: "changeMyName",
      args: newName,
    });
    // anticipate
    myUser.userName = newName;
    renderUserList();
  }
}
const yourRoleDropdown = document.getElementById("yourRoleDropdown") as HTMLSelectElement;
yourRoleDropdown.addEventListener("change", function() {
  setTimeout(function() {
    var role = yourRoleDropdown.value;
    sendMessage({
      cmd: "changeMyRole",
      args: role,
    });
    // anticipate
    myUser.role = role;
    renderUserList();
    // hide/show objects
    getObjects().forEach(object => render(object));
    fixFloatingThingZ();
  }, 0);
});
const closeEditUserButton = document.getElementById("closeEditUserButton") as HTMLInputElement;
closeEditUserButton.addEventListener("click", closeDialog);

const moveLockedObjectsModeCheckbox = document.getElementById("moveLockedObjectsModeCheckbox") as HTMLInputElement;
moveLockedObjectsModeCheckbox.addEventListener("click", function() {
  // Prevent keyboard focus from interfering with hotkeys.
  moveLockedObjectsModeCheckbox.blur();
});


function render(object, isAnimated) {
  if (object.id in examiningObjectsById) return; // different handling for this
  var x = object.x;
  var y = object.y;
  var z = object.z;
  var faceIndex = object.faceIndex;
  var newProps = selectedObjectIdToNewProps[object.id];
  if (newProps != null) {
    x = newProps.x;
    y = newProps.y;
    z = newProps.z;
    faceIndex = newProps.faceIndex;
  }
  if (object.locked) {
    z = 0;
  } else {
    for (var i = 0; i < hiderContainers.length; i++) {
      var hiderContainer = hiderContainers[i];
      if (hiderContainer.x <= x+object.width /2 && x+object.width /2 <= hiderContainer.x + hiderContainer.width &&
          hiderContainer.y <= y+object.height/2 && y+object.height/2 <= hiderContainer.y + hiderContainer.height) {
        if (hiderContainer.visionWhitelist.indexOf(myUser.role) === -1) {
          // blocked
          var forbiddenFaces = hiderContainer.hideFaces.map(resolveFace);
          var betterFaceIndex = -1;
          for (var j = 0; j < object.faces.length; j++) {
            var tryThisIndex = (faceIndex + j) % object.faces.length;
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
  var objectDiv = getObjectDiv(object.id);
  if (isAnimated) {
    objectDiv.classList.add("animatedMovement");
  } else {
    objectDiv.classList.remove("animatedMovement");
  }
  objectDiv.style.left = x + "px";
  objectDiv.style.top  = y + "px";
  objectDiv.style.width  = object.width  + "px";
  objectDiv.style.height = object.height + "px";
  objectDiv.style.zIndex = z;
  if (object.faces.length > 0) {
    var facePath = object.faces[faceIndex];
    let {url} = parseFacePath(facePath);
    objectDiv.dataset.facePath = facePath;
    objectDiv.style.backgroundImage = `url(${url})`;
    renderSize(object, objectDiv, object.width, object.height);
  } else if (object.backgroundColor !== "") {
    objectDiv.style.backgroundColor = object.backgroundColor.replace(/alpha/, "0.4");
    objectDiv.style.borderColor = "rgba(255,255,255,0.8)";
    objectDiv.style.borderWidth = "3px";
    objectDiv.style.borderStyle = "solid";
    objectDiv.style.pointerEvents = "none";
    // adjust rectangle, because the border screws up everything
    objectDiv.style.left = (x - 3) + "px";
    objectDiv.style.top  = (y - 3) + "px";
  } else {
    throw new Error("don't know how to render object");
  }
  objectDiv.style.display = "block";

  if (object.backgroundColor !== "") {
    var backgroundDiv = getBackgroundDiv(object.id);
    if (isAnimated) {
      backgroundDiv.classList.add("animatedMovement");
    } else {
      backgroundDiv.classList.remove("animatedMovement");
    }
    backgroundDiv.style.left = x + "px";
    backgroundDiv.style.top = y + "px";
    backgroundDiv.style.width  = object.width  + "px";
    backgroundDiv.style.height = object.height + "px";
    backgroundDiv.style.zIndex = 0;
    backgroundDiv.style.display = "block";
    backgroundDiv.style.backgroundColor = object.backgroundColor.replace(/alpha/, "1.0");
  }
}
function renderExaminingObjects() {
  // sort by z order. bottom-to-top is left-to-right.
  var objects = [];
  for (var id in examiningObjectsById) {
    objects.push(objectsById[id]);
  }
  objects.sort(function(a, b) {
    return compareZ(examiningObjectsById[a.id], examiningObjectsById[b.id]);
  });

  // how far in can we zoom?
  var totalWidth = 0;
  var maxHeight = 0;
  objects.forEach(function(object) {
    totalWidth += object.width;
    if (object.height > maxHeight) maxHeight = object.height;
  });

  var windowWidth  = window.innerWidth;
  var windowHeight = window.innerHeight;
  var windowAspectRatio = windowWidth / windowHeight;
  var objectsAspectRatio = totalWidth / maxHeight;

  var bigHeight;
  if (windowAspectRatio < objectsAspectRatio) {
    bigHeight = windowWidth  / objectsAspectRatio;
  } else {
    bigHeight = windowHeight;
  }
  var zoomFactor = bigHeight / maxHeight;
  if (zoomFactor < 1.0) {
    // don't ever zoom out with this function. prefer overlapping objects.
    zoomFactor = 1.0;
    totalWidth = windowWidth;
  }
  var averageWidth = totalWidth / objects.length;

  var maxZ = findMaxZ();
  for (var i = 0; i < objects.length; i++) {
    var object = objects[i];
    var renderWidth  = object.width  * zoomFactor;
    var renderHeight = object.height * zoomFactor;
    var renderX = averageWidth * i * zoomFactor;
    var renderY = (windowHeight - renderHeight) / 2;
    var objectDiv = getObjectDiv(object.id);
    objectDiv.classList.add("animatedMovement");
    objectDiv.style.left = (renderX + window.scrollX) + "px";
    objectDiv.style.top  = (renderY + window.scrollY) + "px";
    renderSize(object, objectDiv, renderWidth, renderHeight);
    objectDiv.style.zIndex = maxZ + i + 3;
    var stackHeightDiv = getStackHeightDiv(object.id);
    stackHeightDiv.style.display = "none";
  }
}
function renderSize(object, objectDiv, renderWidth, renderHeight) {
  objectDiv.style.width  = renderWidth  + "px";
  objectDiv.style.height = renderHeight + "px";
  let {url, x, y, width, height} = parseFacePath(objectDiv.dataset.facePath);
  if (x != null) {
    let scaleX = renderWidth  / width;
    let scaleY = renderHeight / height;
    let backgroundSize = imageUrlToSize[url];
    //objectDiv.style.backgroundRepeat = "no-repeat";
    objectDiv.style.backgroundPosition = `-${x * scaleX}px -${y * scaleY}px`;
    objectDiv.style.backgroundSize = `${backgroundSize.width * scaleX}px ${backgroundSize.height * scaleY}px`;
  } else {
    objectDiv.style.backgroundPosition = "";
    objectDiv.style.backgroundSize = "";
  }
}
function renderOrder() {
  var sizeAndLocationToIdAndZList = {};
  getObjects().forEach(function(object) {
    var newProps = selectedObjectIdToNewProps[object.id];
    if (newProps == null) newProps = object;
    if (object.labelPlayerName !== "") {
      // not really a stack height
      return;
    }
    var key = getStackId(newProps, object);
    var idAndZList = sizeAndLocationToIdAndZList[key];
    if (idAndZList == null) idAndZList = sizeAndLocationToIdAndZList[key] = [];
    idAndZList.push({id:object.id, z:newProps.z});
  });
  for (var key in sizeAndLocationToIdAndZList) {
    var idAndZList = sizeAndLocationToIdAndZList[key];
    idAndZList.sort(compareZ);
    idAndZList.forEach(function(idAndZ, i) {
      if (idAndZ.id in examiningObjectsById) return;
      var stackHeightDiv = getStackHeightDiv(idAndZ.id);
      if (i > 0) {
        stackHeightDiv.textContent = (i + 1).toString();
        stackHeightDiv.style.display = "block";
      } else {
        stackHeightDiv.style.display = "none";
      }
    });
  }
}
function getStackId(newProps, object) {
  return [newProps.x, newProps.y, object.width, object.height].join(",");
}
const selectionRectangleDiv = document.getElementById("selectionRectangleDiv") as HTMLDivElement;
function renderSelectionRectangle() {
  if (draggingMode === DRAG_RECTANGLE_SELECT) {
    var x = rectangleSelectStartX;
    var y = rectangleSelectStartY;
    var width  = rectangleSelectEndX - rectangleSelectStartX;
    var height = rectangleSelectEndY - rectangleSelectStartY;
    var borderWidth = parseInt(selectionRectangleDiv.style.borderWidth);
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
  if (draggingMode === DRAG_MOVE_SELECTION) return;
  // at least this minimum size
  var maxX = 800;
  var maxY = 800;
  var padding = 8;
  for (var id in objectsById) {
    var object = objectsById[id];
    var x = object.x + object.width  + padding;
    var y = object.y + object.height + padding;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  tableDiv.style.width  = maxX + "px";
  tableDiv.style.height = maxY + "px";
}

function snapToSnapZones(object, newProps) {
  objectsWithSnapZones.sort(compareZ);
  for (var i = objectsWithSnapZones.length - 1; i >= 0; i--) {
    var containerObject = objectsWithSnapZones[i];
    var containerProps = selectedObjectIdToNewProps[containerObject.id] || containerObject;
    for (var j = 0; j < containerObject.snapZones.length; j++) {
      var snapZoneDefinition = containerObject.snapZones[j];
      var snapZoneX      = snapZoneDefinition.x          != null ? snapZoneDefinition.x          : 0;
      var snapZoneY      = snapZoneDefinition.y          != null ? snapZoneDefinition.y          : 0;
      var snapZoneWidth  = snapZoneDefinition.width      != null ? snapZoneDefinition.width      : containerObject.width;
      var snapZoneHeight = snapZoneDefinition.height     != null ? snapZoneDefinition.height     : containerObject.height;
      var cellWidth      = snapZoneDefinition.cellWidth  != null ? snapZoneDefinition.cellWidth  : snapZoneWidth;
      var cellHeight     = snapZoneDefinition.cellHeight != null ? snapZoneDefinition.cellHeight : snapZoneHeight;
      if (cellWidth  < object.width)  continue; // doesn't fit in the zone
      if (cellHeight < object.height) continue; // doesn't fit in the zone
      if (newProps.x >= containerProps.x + snapZoneX + snapZoneWidth)  continue; // way off right
      if (newProps.y >= containerProps.y + snapZoneY + snapZoneHeight) continue; // way off bottom
      if (newProps.x + object.width  <= containerProps.x + snapZoneX)  continue; // way off left
      if (newProps.y + object.height <= containerProps.y + snapZoneY)  continue; // way off top
      // this is the zone for us
      var relativeCenterX = newProps.x + object.width /2 - (containerProps.x + snapZoneX);
      var relativeCenterY = newProps.y + object.height/2 - (containerProps.y + snapZoneY);
      var modX = euclideanMod(relativeCenterX, cellWidth);
      var modY = euclideanMod(relativeCenterY, cellHeight);
      var divX = Math.floor(relativeCenterX / cellWidth);
      var divY = Math.floor(relativeCenterY / cellHeight);
      var newModX = clamp(modX, object.width /2, cellWidth  - object.width /2);
      var newModY = clamp(modY, object.height/2, cellHeight - object.height/2);

      var inBoundsX = 0 <= relativeCenterX && relativeCenterX < snapZoneWidth;
      var inBoundsY = 0 <= relativeCenterY && relativeCenterY < snapZoneHeight;
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

function getObjects() {
  var objects = [];
  for (var objectId in objectsById) {
    objects.push(objectsById[objectId]);
  }
  return objects;
}
function getObjectsInZOrder() {
  var objects = [];
  objects.sort(compareZ);
  return objects;
}
function compareZ(a, b) {
  return operatorCompare(a.z, b.z);
}
function operatorCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function makeWebSocket() {
  var host = location.host;
  var pathname = location.pathname;
  var isHttps = location.protocol === "https:";
  var match = host.match(/^(.+):(\d+)$/);
  var defaultPort = isHttps ? 443 : 80;
  var port = match ? parseInt(match[2], 10) : defaultPort;
  var hostName = match ? match[1] : host;
  var wsProto = isHttps ? "wss:" : "ws:";
  var wsUrl = wsProto + "//" + hostName + ":" + port + pathname;
  return new WebSocket(wsUrl);
}

var socket;
var isConnected = false;
function connectToServer() {
  setScreenMode(SCREEN_MODE_WAITING_FOR_SERVER_CONNECT);

  socket = makeWebSocket();
  socket.addEventListener('open', onOpen, false);
  socket.addEventListener('message', onMessage, false);
  socket.addEventListener('error', timeoutThenCreateNew, false);
  socket.addEventListener('close', timeoutThenCreateNew, false);

  function onOpen() {
    isConnected = true;
    console.log("connected");
    var roomCodeToSend = roomCode;
    if (roomCode != null) {
      roomCodeToSend = roomCode;
      setScreenMode(SCREEN_MODE_WAITING_FOR_ROOM_CODE_CONFIRMATION);
    } else {
      roomCodeToSend = "new";
      setScreenMode(SCREEN_MODE_WAITING_FOR_CREATE_ROOM);
    }
    sendMessage({
      cmd: "joinRoom",
      args: {
        roomCode: roomCodeToSend,
      },
    });
  }
  function onMessage(event) {
    var msg = event.data;
    if (msg === "keepAlive") return;
    console.log(msg);
    var message = JSON.parse(msg);
    if (screenMode === SCREEN_MODE_WAITING_FOR_ROOM_CODE_CONFIRMATION && message.cmd === "badRoomCode") {
      // nice try
      disconnect();
      setScreenMode(SCREEN_MODE_LOGIN);
      // TODO: show message that says we tried
      return;
    }
    switch (screenMode) {
      case SCREEN_MODE_WAITING_FOR_CREATE_ROOM:
      case SCREEN_MODE_WAITING_FOR_ROOM_CODE_CONFIRMATION:
        if (message.cmd === "joinRoom") {
          setScreenMode(SCREEN_MODE_PLAY);
          roomCode = message.args.roomCode;
          myUser = {
            id: message.args.userId,
            userName: message.args.userName,
            role: message.args.role,
          };
          usersById[myUser.id] = myUser;
          message.args.users.forEach(function(otherUser) {
            usersById[otherUser.id] = otherUser;
          });
          initGame(message.args.database, message.args.game, message.args.history);
          renderUserList();
        } else throw asdf;
        break;
      case SCREEN_MODE_PLAY:
        if (message.cmd === "makeAMove") {
          makeAMove(message.args, true);
        } else if (message.cmd === "userJoined") {
          usersById[message.args.id] = {
            id: message.args.id,
            userName: message.args.userName,
            role: message.args.role,
          };
          renderUserList();
        } else if (message.cmd === "userLeft") {
          delete usersById[message.args.id];
          renderUserList();
        } else if (message.cmd === "changeMyName") {
          usersById[message.args.id].userName = message.args.userName;
          renderUserList();
        } else if (message.cmd === "changeMyRole") {
          usersById[message.args.id].role = message.args.role;
          renderUserList();
        }
        break;
      default: throw asdf;
    }
  }
  function timeoutThenCreateNew() {
    removeListeners();
    if (isConnected) {
      isConnected = false;
      console.log("disconnected");
      deleteTableAndEverything();
      setScreenMode(SCREEN_MODE_DISCONNECTED);
    }
    setTimeout(connectToServer, 1000);
  }
  function disconnect() {
    console.log("disconnect");
    removeListeners();
    socket.close();
    isConnected = false;
  }
  function removeListeners() {
    socket.removeEventListener('open', onOpen, false);
    socket.removeEventListener('message', onMessage, false);
    socket.removeEventListener('error', timeoutThenCreateNew, false);
    socket.removeEventListener('close', timeoutThenCreateNew, false);
  }
}

function sendMessage(message) {
  socket.send(JSON.stringify(message));
}
function makeAMove(move, shouldRender) {
  var objectsToRender = shouldRender ? [] : null;
  var i = 0;
  var userId = move[i++];
  if (userId === myUser.id) return;
  while (i < move.length) {
    var actionCode = move[i++];
    switch (actionCode) {
      case "c": // create
        var object = consumeObjectProps(move, i);
        i += objectPropCount;
        registerObject(object);
        if (shouldRender) objectsToRender.push(object);
        break;
      case "d":
        var object = consumeObjectProps(move, i);
        i += objectPropCount;
        deleteObject(object.id);
        break;
      case "m": // move
        var object = objectsById[move[i++]];
        var fromX         =  move[i++];
        var fromY         =  move[i++];
        var fromZ         =  move[i++];
        var fromFaceIndex =  move[i++];
        var   toX         =  move[i++];
        var   toY         =  move[i++];
        var   toZ         =  move[i++];
        var   toFaceIndex =  move[i++];
        object.x = toX;
        object.y = toY;
        object.z = toZ;
        object.faceIndex = toFaceIndex;
        var newProps = selectedObjectIdToNewProps[object.id];
        if (newProps != null) {
          newProps.x = toX;
          newProps.y = toY;
          newProps.z = toZ;
          newProps.faceIndex = toFaceIndex;
        }
        if (shouldRender) objectsToRender.push(object);
        break;
      default: throw asdf();
    }
  }

  if (shouldRender) {
    objectsToRender.forEach(function(object) {
      render(object, true);
    });
    renderOrder();
    resizeTableToFitEverything();
    fixFloatingThingZ();
  }
  pushChangeToHistory(move);
}

function generateRandomId() {
  var result = "";
  for (var i = 0; i < 16; i++) {
    var n = Math.floor(Math.random() * 16);
    var c = n.toString(16);
    result += c;
  }
  return result;
}
function getObjectDiv(id) {
  return document.getElementById("object-" + id) as HTMLDivElement;
}
function getStackHeightDiv(id) {
  return document.getElementById("stackHeight-" + id) as HTMLDivElement;
}
function getBackgroundDiv(id) {
  return document.getElementById("background-" + id) as HTMLDivElement | null;
}
function setDivVisible(div, visible) {
  div.style.display = visible ? "block" : "none";
}

function sanitizeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function euclideanMod(numerator, denominator) {
  return (numerator % denominator + denominator) % denominator;
}
function clamp(n, min, max) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function undefineNull(key, value) {
  if (value == null) return undefined;
  return value;
}

function httpGet(url, cb) {
  var request = new XMLHttpRequest();
  request.addEventListener("load", function() {
    cb(request.responseText);
  });
  request.open("GET", url);
  request.send();
}

setScreenMode(SCREEN_MODE_LOGIN);
