
var roomCode = null;
var myUser;

var SCREEN_MODE_DISCONNECTED = 0;
var SCREEN_MODE_LOGIN = 1;
var SCREEN_MODE_WAITING_FOR_SERVER_CONNECT = 2;
var SCREEN_MODE_WAITING_FOR_CREATE_ROOM = 3;
var SCREEN_MODE_WAITING_FOR_ROOM_CODE_CONFIRMATION = 4;
var SCREEN_MODE_PLAY = 5;
var screenMode = SCREEN_MODE_LOGIN;

document.getElementById("createRoomButton").addEventListener("click", function() {
  roomCode = null;
  connectToServer();
});
document.getElementById("roomCodeTextbox").addEventListener("keydown", function(event) {
  event.stopPropagation();
  if (event.keyCode === 13) {
    setTimeout(submitRoomCode, 0);
  } else {
    setTimeout(function() {
      var textbox = document.getElementById("roomCodeTextbox");
      var value = textbox.value;
      var canonicalValue = value.toUpperCase();
      if (value === canonicalValue) return;
      var selectionStart = textbox.selectionStart;
      var selectionEnd = textbox.selectionEnd;
      textbox.value = canonicalValue;
      textbox.selectionStart = selectionStart;
      textbox.selectionEnd = selectionEnd;
    }, 0);
  }
});
document.getElementById("joinRoomButton").addEventListener("click", submitRoomCode);
function submitRoomCode() {
  roomCode = document.getElementById("roomCodeTextbox").value;
  connectToServer();
}

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
    setDivVisible(document.getElementById(divId), divId === activeDivId);
  });
  if (activeDivId === "loginDiv") document.getElementById("roomCodeTextbox").focus();
  document.getElementById("loadingMessageDiv").textContent = loadingMessage != null ? loadingMessage : "Please wait...";
}

var tableDiv = document.getElementById("tableDiv");

var usersById = {};

var facePathToUrlUrl = {
  //"face1.png": "", // loading...
  //"face2.png": 'url("face2.png")',
  //"face3.png#0,0,32,32": 'url("data://...")',
};

var gameDefinition;
var objectsById;
var objectsWithSnapZones; // cache
var changeHistory;
var futureChanges;
function initGame(game, history) {
  gameDefinition = game;
  objectsById = {};
  objectsWithSnapZones = [];
  changeHistory = [];
  futureChanges = [];
  for (var id in gameDefinition.objects) {
    if (gameDefinition.objects[id].prototype) continue;
    var objectDefinition = getObjectDefinition(id);
    if (objectDefinition.faces != null) objectDefinition.faces.forEach(preloadImagePath);
    var object = {
      id: id,
      x: gameDefinition.coordinates.originX + gameDefinition.coordinates.unitWidth  * objectDefinition.x,
      y: gameDefinition.coordinates.originY + gameDefinition.coordinates.unitHeight * objectDefinition.y,
      z: objectDefinition.z || 0,
      width:  gameDefinition.coordinates.unitWidth  * objectDefinition.width,
      height: gameDefinition.coordinates.unitHeight * objectDefinition.height,
      faces: objectDefinition.faces,
      snapZones: objectDefinition.snapZones || [],
      locked: !!objectDefinition.locked,
      faceIndex: 0,
    };
    objectsById[id] = object;
    if (object.snapZones.length > 0) objectsWithSnapZones.push(object);

    tableDiv.insertAdjacentHTML("beforeend",
      '<div id="object-'+id+'" data-id="'+id+'" class="gameObject" style="display:none;">' +
        '<div id="stackHeight-'+id+'" class="stackHeight" style="display:none;"></div>' +
      '</div>'
    );
    var objectDiv = getObjectDiv(object.id);
    objectDiv.addEventListener("mousedown", onObjectMouseDown);
    objectDiv.addEventListener("mousemove", onObjectMouseMove);
    objectDiv.addEventListener("mouseout",  onObjectMouseOut);
  }
  // reassign all the z's to be unique
  var objects = getObjects();
  objects.sort(compareZ);
  objects.forEach(function(object, i) {
    object.z = i;
  });
  fixFloatingThingZ();

  // replay history
  history.forEach(function(move) {
    makeAMove(move, false);
  });

  document.getElementById("roomCodeSpan").textContent = roomCode;

  checkForDoneLoading();
}
function getObjectDefinition(id) {
  // resolve prototypes
  var result = {};
  recurse(id, 0);
  return result;

  function recurse(id, depth) {
    var definition = gameDefinition.objects[id];
    for (var property in definition) {
      if (property === "prototypes") continue; // special handling
      if (property === "prototype" && depth !== 0) continue;  // don't inherit this property
      if (property in result) continue; // shadowed
      var value = definition[property];
      if (property === "front") {
        if (result.faces == null) result.faces = [];
        result.faces[0] = value;
      } else if (property === "back") {
        if (result.faces == null) result.faces = [];
        result.faces[1] = value;
      } else {
        result[property] = value;
      }
    }
    if (definition.prototypes != null) {
      definition.prototypes.forEach(function(id) {
        recurse(id, depth + 1);
      });
    }
  }
}
function preloadImagePath(path) {
  var url = facePathToUrlUrl[path];
  if (url != null) return; // already loaded or loading
  facePathToUrlUrl[path] = ""; // loading...
  var img = new Image();
  var hashIndex = path.indexOf("#");
  if (hashIndex !== -1) {
    var cropInfo = path.substring(hashIndex + 1).split(",");
    if (cropInfo.length !== 4) throw new Error("malformed url: " + path);
    img.src = path.substring(0, hashIndex);
  } else {
    img.src = path;
  }
  img.addEventListener("load", function() {
    if (cropInfo != null) {
      var x = parseInt(cropInfo[0], 10);
      var y = parseInt(cropInfo[1], 10);
      var width = parseInt(cropInfo[2], 10);
      var height = parseInt(cropInfo[3], 10);
      var canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      var context = canvas.getContext("2d");
      context.drawImage(img, x, y, width, height, 0, 0, width, height);
      facePathToUrlUrl[path] = 'url("'+canvas.toDataURL()+'")';
    } else {
      facePathToUrlUrl[path] = 'url("'+path+'")';
    }
    checkForDoneLoading();
  });
}
function checkForDoneLoading() {
  for (var key in facePathToUrlUrl) {
    if (facePathToUrlUrl[key] === "") return; // not done yet
  }
  // all done loading
  getObjects().forEach(render);
  renderOrder();
  resizeTableToFitEverything();
  fixFloatingThingZ();
}

function deleteTableAndEverything() {
  tableDiv.innerHTML = "";
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
  var maxZ = findMaxZ(examiningObjectsById) + Object.keys(examiningObjectsById).length;
  document.getElementById("roomInfoDiv").style.zIndex = maxZ + 1;
  document.getElementById("helpDiv").style.zIndex = maxZ + 2;
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
  if (object.locked) return; // click thee behind me, satan
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
  renderAndMaybeCommitSelection(selection);
  fixFloatingThingZ();
}
function onObjectMouseMove(event) {
  if (draggingMode != DRAG_NONE) return;
  var objectDiv = this;
  var object = objectsById[objectDiv.dataset.id];
  if (object.locked) return;
  setHoverObject(object);
}
function onObjectMouseOut(event) {
  var objectDiv = this;
  var object = objectsById[objectDiv.dataset.id];
  if (hoverObject === object) {
    setHoverObject(null);
  }
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
        if (object.locked) return;
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
    // snap everything really quick
    for (var id in selectedObjectIdToNewProps) {
      var object = objectsById[id];
      var newProps = selectedObjectIdToNewProps[id];
      if (snapToSnapZones(newProps)) {
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
  if (hoverObject != null) {
    getObjectDiv(hoverObject.id).classList.remove("hoverSelect");
  }
  hoverObject = object;
  if (hoverObject != null) {
    getObjectDiv(hoverObject.id).classList.add("hoverSelect");
  }
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
function renderAndMaybeCommitSelection(selection) {
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
  objectsToRender.forEach(render);
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
    if (!(object.x === newProps.x &&
          object.y === newProps.y &&
          object.z === newProps.z &&
          object.faceIndex === newProps.faceIndex)) {
      move.push(
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
  if (move.length <= 1) return;
  var message = {
    cmd: "makeAMove",
    args: move,
  };
  sendMessage(message);
  pushChangeToHistory(move);
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
  renderAndMaybeCommitSelection(selection);
  renderOrder();
}
function rollSelection() {
  var selection = getEffectiveSelection();
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
    newProps.faceIndex = Math.floor(Math.random() * object.faces.length);
  }
  renderAndMaybeCommitSelection(selection);
  renderOrder();
}
function cancelMove() {
  var selection = selectedObjectIdToNewProps;
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
    newProps.x = object.x;
    newProps.y = object.y;
    newProps.z = object.z;
    newProps.faceIndex = object.faceIndex;
    render(object, true);
  }
  draggingMode = DRAG_NONE;
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
  renderAndMaybeCommitSelection(selection);
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
  renderAndMaybeCommitSelection(selection);
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
      if (object.locked) return; // don't look at me
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
document.getElementById("helpDiv").addEventListener("mousemove", function() {
  if (draggingMode !== DRAG_NONE) return;
  isHelpMouseIn = true;
  renderHelp();
});
document.getElementById("helpDiv").addEventListener("mouseout", function() {
  isHelpMouseIn = false;
  renderHelp();
});
function renderHelp() {
  if (isHelpShown || isHelpMouseIn) {
    document.getElementById("helpDiv").classList.add("helpExpanded");
  } else {
    document.getElementById("helpDiv").classList.remove("helpExpanded");
  }
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
    newMove.push(
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

function renderUserList() {
  var userListUl = document.getElementById("userListUl");
  var userIds = Object.keys(usersById);
  userIds.sort();
  userListUl.innerHTML = userIds.map(function(userId) {
    return (
      '<li'+(userId === myUser.id ? ' id="myUserNameLi"' : '')+' title="Click to edit your name">' +
        sanitizeHtml(usersById[userId].userName) +
      '</li>');
  }).join("");

  document.getElementById("myUserNameLi").addEventListener("click", function() {
    var newName = prompt("New name (max length 16 characters):");
    if (!newName) return;
    sendMessage({
      cmd: "changeMyName",
      args: newName,
    });
    if (newName.length > 16) newName = newName.substring(0, 16);
    // anticipate
    myUser.userName = newName;
    renderUserList();
  });
}

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
  var objectDiv = getObjectDiv(object.id);
  var facePath = object.faces[faceIndex];
  var imageUrlUrl = facePathToUrlUrl[facePath];
  if (isAnimated) {
    objectDiv.classList.add("animatedMovement");
  } else {
    objectDiv.classList.remove("animatedMovement");
  }
  objectDiv.style.left = x + "px";
  objectDiv.style.top  = y + "px";
  objectDiv.style.width  = object.width;
  objectDiv.style.height = object.height;
  objectDiv.style.zIndex = z;
  if (imageUrlUrl !== "" && objectDiv.dataset.facePath !== facePath) {
    objectDiv.dataset.facePath = facePath;
    objectDiv.style.backgroundImage = imageUrlUrl;
  }
  objectDiv.style.display = "block";
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
    objectDiv.style.left = renderX + window.scrollX;
    objectDiv.style.top  = renderY + window.scrollY;
    objectDiv.style.width  = renderWidth;
    objectDiv.style.height = renderHeight;
    objectDiv.style.zIndex = maxZ + i + 3;
    var stackHeightDiv = getStackHeightDiv(object.id);
    stackHeightDiv.style.display = "none";
  }
}
function renderOrder() {
  var sizeAndLocationToIdAndZList = {};
  getObjects().forEach(function(object) {
    var newProps = selectedObjectIdToNewProps[object.id];
    if (newProps == null) newProps = object;
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
function renderSelectionRectangle() {
  var selectionRectangleDiv = document.getElementById("selectionRectangleDiv");
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
function renderNumberBuffer() {
  var numberBufferDiv = document.getElementById("numberBufferDiv");
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

function snapToSnapZones(newProps) {
  objectsWithSnapZones.sort(compareZ);
  var unitWidth  = gameDefinition.coordinates.unitWidth;
  var unitHeight = gameDefinition.coordinates.unitHeight;
  for (var i = objectsWithSnapZones.length - 1; i >= 0; i--) {
    var containerObject = objectsWithSnapZones[i];
    var containerRelativeX = newProps.x - containerObject.x;
    var containerRelativeY = newProps.y - containerObject.y;
    var containerObjectDefinition = getObjectDefinition(containerObject.id);
    for (var j = 0; j < containerObjectDefinition.snapZones.length; j++) {
      var snapZoneDefinition = containerObjectDefinition.snapZones[j];
      var snapZoneX      = snapZoneDefinition.x      * unitWidth;
      var snapZoneY      = snapZoneDefinition.y      * unitHeight;
      var snapZoneWidth  = snapZoneDefinition.width  * unitWidth;
      var snapZoneHeight = snapZoneDefinition.height * unitHeight;
      var snapZoneRelativeX = containerRelativeX - snapZoneX;
      var snapZoneRelativeY = containerRelativeY - snapZoneY * unitHeight;
      if (snapZoneRelativeX < -unitWidth  || snapZoneRelativeX > snapZoneWidth)  continue; // way out of bounds
      if (snapZoneRelativeY < -unitHeight || snapZoneRelativeY > snapZoneHeight) continue; // way out of bounds
      // this is the zone for us
      var roundedSnapZoneRelativeX = Math.round(snapZoneRelativeX / unitWidth)  * unitWidth;
      var roundedSnapZoneRelativeY = Math.round(snapZoneRelativeY / unitHeight) * unitHeight;
      var inBoundsX = 0 <= roundedSnapZoneRelativeX && roundedSnapZoneRelativeX < snapZoneWidth;
      var inBoundsY = 0 <= roundedSnapZoneRelativeY && roundedSnapZoneRelativeY < snapZoneHeight;
      if (!inBoundsX && !inBoundsY) {
        // on an outside corner. we need to pick an edge to rub.
        if (Math.abs(roundedSnapZoneRelativeX - snapZoneRelativeX) > Math.abs(roundedSnapZoneRelativeY - snapZoneRelativeY)) {
          // x is further off
          inBoundsX = true;
        } else {
          // y is further off
          inBoundsY = true;
        }
      }
      if (inBoundsY) {
        newProps.x = roundedSnapZoneRelativeX + snapZoneX + containerObject.x;
      }
      if (inBoundsX) {
        newProps.y = roundedSnapZoneRelativeY + snapZoneY + containerObject.y;
      }
      return inBoundsX || inBoundsY;
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
          };
          usersById[myUser.id] = myUser;
          message.args.users.forEach(function(otherUser) {
            usersById[otherUser.id] = otherUser;
          });
          initGame(message.args.game, message.args.history);
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
          };
          renderUserList();
        } else if (message.cmd === "userLeft") {
          delete usersById[message.args.id];
          renderUserList();
        } else if (message.cmd === "changeMyName") {
          usersById[message.args.id].userName = message.args.userName;
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
    var object = objectsById[move[i++]];
    var fromX         =      move[i++];
    var fromY         =      move[i++];
    var fromZ         =      move[i++];
    var fromFaceIndex =      move[i++];
    var   toX         =      move[i++];
    var   toY         =      move[i++];
    var   toZ         =      move[i++];
    var   toFaceIndex =      move[i++];
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
  return document.getElementById("object-" + id);
}
function getStackHeightDiv(id) {
  return document.getElementById("stackHeight-" + id);
}
function setDivVisible(div, visible) {
  div.style.display = visible ? "block" : "none";
}

function sanitizeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

setScreenMode(SCREEN_MODE_LOGIN);
