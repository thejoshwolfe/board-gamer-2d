var mainDiv = document.getElementById("mainDiv");
var userName = null;

var imageCache = {
  //"path/to/image.png": {
  //  img: new Image(),
  //  x: 0, // for spritesheets
  //  y: 0,
  //  width: 100,
  //  height: 100,
  //},
};

var gameDefinition;
var objectsById;
var objectsWithSnapZones; // cache
var changeHistory;
var futureChanges;
function initGame() {
  objectsById = {};
  objectsWithSnapZones = [];
  changeHistory = [];
  futureChanges = [];
  var maxZ = null;
  for (var id in gameDefinition.objects) {
    if (gameDefinition.objects[id].prototype) continue;
    var objectDefinition = getObjectDefinition(id);
    if (objectDefinition.faces != null) objectDefinition.faces.forEach(preloadImagePath);
    var object = {
      id: id,
      x: objectDefinition.x,
      y: objectDefinition.y,
      z: objectDefinition.z || 0,
      width: objectDefinition.width,
      height: objectDefinition.height,
      faces: objectDefinition.faces,
      snapZones: objectDefinition.snapZones || [],
      locked: !!objectDefinition.locked,
      faceIndex: 0,
    };
    objectsById[id] = object;
    if (object.snapZones.length > 0) objectsWithSnapZones.push(object);

    mainDiv.insertAdjacentHTML("beforeend", '<canvas id="'+id+'" class="gameObject" style="display:none;"></canvas>');
    var objectDiv = document.getElementById(object.id);
    objectDiv.addEventListener("mousedown", onObjectMouseDown);
    objectDiv.addEventListener("mousemove", onObjectMouseMove);
    objectDiv.addEventListener("mouseout", onObjectMouseOut);
  }
  // and now reassign all the z's to be unique
  var objects = getObjects();
  objects.sort(compareZ);
  objects.forEach(function(object, i) {
    object.z = i;
  });
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
    var prototypes = definition.prototypes || [];
    prototypes.forEach(function(id) {
      recurse(id, depth + 1);
    });
  }
}
function preloadImagePath(path) {
  var entry = imageCache[path];
  if (entry != null) return;
  entry = imageCache[path] = {
    img: new Image(),
    x: 0,
    y: 0,
    width: null,
    height: null,
  };
  var hashIndex = path.indexOf("#");
  if (hashIndex !== -1) {
    cropInfo = path.substring(hashIndex + 1).split(",");
    if (cropInfo.length !== 4) throw new Error("malformed url: " + path);
    entry.x = parseInt(cropInfo[0], 10);
    entry.y = parseInt(cropInfo[1], 10);
    entry.width = parseInt(cropInfo[2], 10);
    entry.height = parseInt(cropInfo[3], 10);
    entry.img.src = path.substring(0, hashIndex);
  } else {
    entry.img.src = path;
  }
  entry.img.addEventListener("load", function() {
    if (entry.width == null) {
      entry.width  = entry.img.naturalWidth;
      entry.height = entry.img.naturalHeight;
    }
    checkForDoneLoading();
  });
}
function checkForDoneLoading() {
  for (var key in imageCache) {
    var entry = imageCache[key];
    if (!entry.img.complete) return; // not done yet
  }
  // all done loading
  getObjects().forEach(render);
}

function deleteEverything() {
  mainDiv.innerHTML = "";
  userName = null;
  gameDefinition = null;
  objectsById = null;
  selectedObjectIdToNewProps = {};
  // leave the image cache alone
}
function bringSelectionToTop() {
  // effectively do a stable sort.
  var selection = getEffectiveSelection();
  var z = null;
  getObjects().forEach(function(object) {
    if (object.id in selection) return;
    if (z == null || object.z > z) z = object.z;
  });
  var selectedObjects = [];
  for (var id in selection) {
    selectedObjects.push(objectsById[id]);
  }
  selectedObjects.forEach(function(object) {
    z += 1;
    var newProps = selection[object.id];
    if (newProps.z !== z) {
      newProps.z = z;
      // special case rendering for this one property
      document.getElementById(object.id).style.zIndex = z;
    }
  });
  maybeCommitSelection(selection);
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

var hoverObject;
var draggingMouseStartX;
var draggingMouseStartY;
function onObjectMouseDown(event) {
  if (event.button !== 0) return;
  var objectDiv = this;
  var object = objectsById[objectDiv.id];
  if (object.locked) return; // click thee behind me, satan
  event.preventDefault();
  event.stopPropagation();

  // select
  if (selectedObjectIdToNewProps[object.id] == null) {
    setSelectedObjects([object]);
  }
  if (hoverObject != null) {
    document.getElementById(hoverObject.id).classList.remove("hoverSelect");
  }

  // begin drag
  draggingMode = DRAG_MOVE_SELECTION;
  draggingMouseStartX = eventToMouseX(event, mainDiv);
  draggingMouseStartY = eventToMouseY(event, mainDiv);
  bringSelectionToTop();

  render(object);
}
function onObjectMouseMove(event) {
  var objectDiv = this;
  var object = objectsById[objectDiv.id];
  if (object.locked) return;
  if (hoverObject !== object) {
    hoverObject = object;
    objectDiv.classList.add("hoverSelect");
  }
}
function onObjectMouseOut(event) {
  var objectDiv = this;
  var object = objectsById[objectDiv.id];
  if (hoverObject === object) {
    objectDiv.classList.remove("hoverSelect");
    hoverObject = null;
  }
}

mainDiv.addEventListener("mousedown", function(event) {
  // clicking the table
  event.preventDefault();
  draggingMode = DRAG_RECTANGLE_SELECT;
  rectangleSelectStartX = eventToMouseX(event, mainDiv);
  rectangleSelectStartY = eventToMouseY(event, mainDiv);
  setSelectedObjects([]);
});

document.addEventListener("mousemove", function(event) {
  var x = eventToMouseX(event, mainDiv);
  var y = eventToMouseY(event, mainDiv);
  if (draggingMode === DRAG_RECTANGLE_SELECT) {
    rectangleSelectEndX = x;
    rectangleSelectEndY = y;
    renderSelectionRectangle();
    (function() {
      var minX = (rectangleSelectStartX - gameDefinition.coordinates.originX) / gameDefinition.coordinates.unitWidth;
      var minY = (rectangleSelectStartY - gameDefinition.coordinates.originY) / gameDefinition.coordinates.unitHeight;
      var maxX = (rectangleSelectEndX   - gameDefinition.coordinates.originX) / gameDefinition.coordinates.unitWidth;
      var maxY = (rectangleSelectEndY   - gameDefinition.coordinates.originY) / gameDefinition.coordinates.unitHeight;
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
    // pixels
    var dx = x - draggingMouseStartX;
    var dy = y - draggingMouseStartY;
    objectsWithSnapZones.sort(compareZ);
    Object.keys(selectedObjectIdToNewProps).forEach(function(id) {
      var object = objectsById[id];
      var newProps = selectedObjectIdToNewProps[id];
      // units
      var objectNewX = object.x + dx / gameDefinition.coordinates.unitWidth;
      var objectNewY = object.y + dy / gameDefinition.coordinates.unitHeight;
      // snap zones
      (function() {
        for (var i = objectsWithSnapZones.length - 1; i >= 0; i--) {
          var containerObject = objectsWithSnapZones[i];
          var containerRelativeX = objectNewX - containerObject.x;
          var containerRelativeY = objectNewY - containerObject.y;
          var containerObjectDefinition = getObjectDefinition(containerObject.id);
          for (var j = 0; j < containerObjectDefinition.snapZones.length; j++) {
            var snapZone = containerObjectDefinition.snapZones[j];
            var snapZoneRelativeX = containerRelativeX - snapZone.x;
            var snapZoneRelativeY = containerRelativeY - snapZone.y;
            if (snapZoneRelativeX < -1 || snapZoneRelativeX > snapZone.width)  continue; // way out of bounds
            if (snapZoneRelativeY < -1 || snapZoneRelativeY > snapZone.height) continue; // way out of bounds
            // this is the zone for us
            var roundedSnapZoneRelativeX = Math.round(snapZoneRelativeX);
            var roundedSnapZoneRelativeY = Math.round(snapZoneRelativeY);
            var inBoundsX = 0 <= roundedSnapZoneRelativeX && roundedSnapZoneRelativeX < snapZone.width;
            var inBoundsY = 0 <= roundedSnapZoneRelativeY && roundedSnapZoneRelativeY < snapZone.height;
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
              objectNewX = roundedSnapZoneRelativeX + snapZone.x + containerObject.x;
            }
            if (inBoundsX) {
              objectNewY = roundedSnapZoneRelativeY + snapZone.y + containerObject.y;
            }
            return;
          }
        }
      })();
      if (!(newProps.x === objectNewX &&
            newProps.y === objectNewY)) {
        newProps.x = objectNewX;
        newProps.y = objectNewY;
        render(object);
      }
    });
    bringSelectionToTop();
  }
});
document.addEventListener("mouseup", function(event) {
  if (draggingMode === DRAG_RECTANGLE_SELECT) {
    draggingMode = DRAG_NONE;
    renderSelectionRectangle();
  } else if (draggingMode === DRAG_MOVE_SELECTION) {
    draggingMode = DRAG_NONE;
    commitSelection(selectedObjectIdToNewProps);
  }
});

function setSelectedObjects(objects) {
  for (var id in selectedObjectIdToNewProps) {
    var objectDiv = document.getElementById(id);
    objectDiv.classList.remove("selected");
  }
  selectedObjectIdToNewProps = {};
  objects.forEach(function(object) {
    selectedObjectIdToNewProps[object.id] = newPropsForObject(object);
  });
  for (var id in selectedObjectIdToNewProps) {
    var objectDiv = document.getElementById(id);
    objectDiv.classList.add("selected");
  }

  // TODO: fix this logic
  if (hoverObject != null) {
    // back to just hovering
    document.getElementById(hoverObject.id).classList.add("hoverSelect");
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
  // if you make changes, call maybeCommitSelection
  if (Object.keys(selectedObjectIdToNewProps).length > 0) return selectedObjectIdToNewProps;
  if (hoverObject != null) {
    var effectiveSelection = {};
    effectiveSelection[hoverObject.id] = newPropsForObject(hoverObject);
    return effectiveSelection;
  }
  return {};
}
function maybeCommitSelection(selection) {
  if (draggingMode === DRAG_MOVE_SELECTION) return; // commit when we let go
  commitSelection(selection);
}
function commitSelection(selection) {
  var messages = [];
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
    if (!(object.x === newProps.x &&
          object.y === newProps.y &&
          object.z === newProps.z &&
          object.faceIndex === newProps.faceIndex)) {
      var message = {
        cmd: "moveObject",
        user: userName,
        args: {
          id: object.id,
          from: {
            x: object.x,
            y: object.y,
            z: object.z,
            faceIndex: object.faceIndex,
          },
          to: {
            x: newProps.x,
            y: newProps.y,
            z: newProps.z,
            faceIndex: newProps.faceIndex,
          },
        },
      };
      messages.push(message);
      pushChangeToHistory(message);
      // anticipate
      object.x = newProps.x;
      object.y = newProps.y;
      object.z = newProps.z;
      object.faceIndex = newProps.faceIndex;
    }
  }
  if (messages.length === 1) {
    sendMessage(messages[0]);
  } else if (messages.length > 1) {
    sendMessage({
      cmd: "multi",
      user: userName,
      args: messages,
    });
  }
}

var SHIFT = 1;
var CTRL = 2;
var ALT = 4;
document.addEventListener("keydown", function(event) {
  var modifierMask = (
    (event.shiftKey ? SHIFT : 0) |
    (event.ctrlKey ? CTRL : 0) |
    (event.altKey ? ALT : 0)
  );
  switch (event.keyCode) {
    case "R".charCodeAt(0):
      if (modifierMask === 0) { rollDraggingObject(); break; }
      return;
    case "F".charCodeAt(0):
      if (modifierMask === 0) { flipOverSelection(); break; }
      return;
    case "Z".charCodeAt(0):
      if (draggingMode === DRAG_NONE && modifierMask === CTRL)       { undo(); break; }
      if (draggingMode === DRAG_NONE && modifierMask === CTRL|SHIFT) { redo(); break; }
      return;
    case "Y".charCodeAt(0):
      if (modifierMask === CTRL) { redo(); break; }
      return;
    default: return;
  }
  event.preventDefault();
});

function flipOverSelection() {
  var selection = getEffectiveSelection();
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
    newProps.faceIndex += 1;
    if (object.faces.length === newProps.faceIndex) {
      newProps.faceIndex = 0;
    }
    render(object);
  }
  maybeCommitSelection(selection);
}
function rollDraggingObject() {
  var selection = getEffectiveSelection();
  for (var id in selection) {
    var object = objectsById[id];
    var newProps = selection[id];
    newProps.faceIndex = Math.floor(Math.random() * object.faces.length);
    render(object);
  }
  maybeCommitSelection(selection);
}

function undo() {
  if (changeHistory.length === 0) return;
  futureChanges.push(reverseChange(changeHistory.pop()));
}
function redo() {
  if (futureChanges.length === 0) return;
  changeHistory.push(reverseChange(futureChanges.pop()));
}
function reverseChange(change) {
  if (change.cmd !== "moveObject") throw asdf;
  var object = objectsById[change.args.id];
  object.x = change.args.from.x;
  object.y = change.args.from.y;
  object.z = change.args.from.z;
  object.faceIndex = change.args.from.faceIndex;
  render(object, true);

  var newChange = JSON.parse(JSON.stringify(change));
  var tmp = newChange.args.from;
  newChange.args.from = newChange.args.to;
  newChange.args.to = tmp;
  newChange.user = userName;
  sendMessage(newChange);
  return newChange;
}
function pushChangeToHistory(change) {
  changeHistory.push(change);
  futureChanges = [];
}

function eventToMouseX(event, mainDiv) { return event.clientX - mainDiv.getBoundingClientRect().left; }
function eventToMouseY(event, mainDiv) { return event.clientY - mainDiv.getBoundingClientRect().top; }

function render(object, isAnimated) {
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
  var objectDiv = document.getElementById(object.id);
  var facePath = object.faces[faceIndex];
  var pixelX = mainDiv.offsetLeft + gameDefinition.coordinates.originX + gameDefinition.coordinates.unitWidth  * x;
  var pixelY = mainDiv.offsetTop  + gameDefinition.coordinates.originY + gameDefinition.coordinates.unitHeight * y;
  var pixelWidth = gameDefinition.coordinates.unitWidth * object.width;
  var pixelHeight = gameDefinition.coordinates.unitHeight * object.height;
  var entry = imageCache[facePath];
  if (isAnimated) {
    objectDiv.classList.add("animatedMovement");
  } else {
    objectDiv.classList.remove("animatedMovement");
  }
  objectDiv.width  = entry.width;
  objectDiv.height = entry.height;
  objectDiv.style.left = pixelX + "px";
  objectDiv.style.top  = pixelY + "px";
  objectDiv.style.width  = pixelWidth;
  objectDiv.style.height = pixelHeight;
  objectDiv.style.zIndex = z;
  var context = objectDiv.getContext("2d");
  context.drawImage(entry.img, entry.x, entry.y, entry.width, entry.height, 0, 0, entry.width, entry.height);
  objectDiv.style.display = "block";
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
    selectionRectangleDiv.style.left = (mainDiv.offsetLeft + x) + "px";
    selectionRectangleDiv.style.top  = (mainDiv.offsetTop  + y) + "px";
    selectionRectangleDiv.style.width  = width  + "px";
    selectionRectangleDiv.style.height = height + "px";
    selectionRectangleDiv.style.display = "block";
  } else {
    selectionRectangleDiv.style.display = "none";
  }
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

var socket;
var isConnected = false;
function connectToServer() {
  var host = location.host;
  var pathname = location.pathname;
  var isHttps = location.protocol === "https:";
  var match = host.match(/^(.+):(\d+)$/);
  var defaultPort = isHttps ? 443 : 80;
  var port = match ? parseInt(match[2], 10) : defaultPort;
  var hostName = match ? match[1] : host;
  var wsProto = isHttps ? "wss:" : "ws:";
  var wsUrl = wsProto + "//" + hostName + ":" + port + pathname;
  socket = new WebSocket(wsUrl);
  socket.addEventListener('open', onOpen, false);
  socket.addEventListener('message', onMessage, false);
  socket.addEventListener('error', timeoutThenCreateNew, false);
  socket.addEventListener('close', timeoutThenCreateNew, false);

  function onOpen() {
    isConnected = true;
    connectionEstablished();
  }
  function onMessage(event) {
    var msg = event.data;
    if (msg === "keepAlive") return;
    console.log(msg);
    var message = JSON.parse(msg);
    handleMessage(message);
  }
  function timeoutThenCreateNew() {
    socket.removeEventListener('error', timeoutThenCreateNew, false);
    socket.removeEventListener('close', timeoutThenCreateNew, false);
    socket.removeEventListener('open', onOpen, false);
    if (isConnected) {
      isConnected = false;
      connectionLost();
    }
    setTimeout(connectToServer, 1000);
  }
}

function connectionEstablished() {
  console.log("connected");
}
function connectionLost() {
  console.log("disconnected");
  deleteEverything();
}
function sendMessage(message) {
  socket.send(JSON.stringify(message));
}
function handleMessage(message) {
  switch (message.cmd) {
    case "login":
      userName = message.args;
      break;
    case "game":
      gameDefinition = message.args;
      initGame();
      break;
    case "multi":
      message.args.forEach(handleMessage);
      break;
    case "moveObject":
      if (message.user === userName) return;
      pushChangeToHistory(message);
      var object = objectsById[message.args.id];
      object.x = message.args.to.x;
      object.y = message.args.to.y;
      object.z = message.args.to.z;
      object.faceIndex = message.args.to.faceIndex;
      render(object, true);
      break;
    default:
      console.log("unknown command:", message.cmd);
  }
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
function roundToFactor(n, factor) {
  // roundToFactor(1.49,  1)    => 1
  // roundToFactor(1.5,   1)    => 2
  // roundToFactor(1.49,  2)    => 2
  // roundToFactor(1.49,  3)    => 0
  // roundToFactor(13,    2)    => 14
  // roundToFactor(13,    3)    => 12
  // roundToFactor(0.625, 0.25) => 0.75
  // roundToFactor(x,     0)    => x
  if (factor === 0) return n;
  return Math.round(n / factor) * factor;
}

connectToServer();
