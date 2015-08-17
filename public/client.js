var mainDiv = document.getElementById("mainDiv");
var userName = null;

var gameDefinition;
var objectsById;
var changeHistory;
var futureChanges;
function setGameDefinition(asdf) {
  objectsById = {};
  changeHistory = [];
  futureChanges = [];
  for (var id in gameDefinition.objects) {
    var objectDefinition = getObjectDefinition(id);
    if (objectDefinition.prototype) continue;
    var object = {
      id: id,
      x: objectDefinition.x,
      y: objectDefinition.y,
      z: objectDefinition.z,
      faceIndex: 0,
    };
    objectsById[id] = object;

    mainDiv.insertAdjacentHTML("beforeend", '<img id="'+id+'" class="gameObject">');
    var objectImg = document.getElementById(object.id);
    objectImg.addEventListener("mousedown", onObjectMouseDown);
    render(object);
  }
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
      result[property] = value;
    }
    var prototypes = definition.prototypes || [];
    prototypes.forEach(function(id) {
      recurse(id, depth + 1);
    });
  }
}

function deleteEverything() {
  mainDiv.innerHTML = "";
  userName = null;
  gameDefinition = null;
  objectsById = null;
}
function bringDraggingObjectToTop() {
  var objects = getObjectsInZOrder();
  if (objects[objects.length - 1] !== draggingObject) {
    draggingObjectNewZ = objects[objects.length - 1].z + 1;
  }
}

var draggingObject;
var draggingObjectNewX;
var draggingObjectNewY;
var draggingObjectNewZ;
var draggingObjectNewFaceIndex;
var draggingMouseStartX;
var draggingMouseStartY;
function onObjectMouseDown(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  var objectImg = this;
  var objectId = objectImg.id;
  var object = objectsById[objectId];
  if (getObjectDefinition(object.id).movable === false) return;

  // begin drag
  objectImg.classList.add("instantMove");
  var x = eventToMouseX(event, mainDiv);
  var y = eventToMouseY(event, mainDiv);
  draggingObject = object;
  draggingObjectNewX = object.x;
  draggingObjectNewY = object.y;
  draggingObjectNewZ = object.z;
  draggingObjectNewFaceIndex = object.faceIndex;
  draggingMouseStartX = x;
  draggingMouseStartY = y;

  bringDraggingObjectToTop();
  render(object);
}
document.addEventListener("mouseup", function(event) {
  if (draggingObject != null) {
    if (!(draggingObject.x === draggingObjectNewX &&
          draggingObject.y === draggingObjectNewY &&
          draggingObject.z === draggingObjectNewZ &&
          draggingObject.faceIndex === draggingObjectNewFaceIndex)) {
      moveObject(draggingObject, draggingObjectNewX, draggingObjectNewY, draggingObjectNewZ, draggingObjectNewFaceIndex);

      var objectImg = document.getElementById(draggingObject.id);
      objectImg.classList.remove("instantMove");
    }
    draggingObject = null;
  }
});
mainDiv.addEventListener("mousemove", function(event) {
  if (draggingObject != null) {
    var object = draggingObject;
    // pixels
    var x = eventToMouseX(event, mainDiv);
    var y = eventToMouseY(event, mainDiv);
    var dx = x - draggingMouseStartX;
    var dy = y - draggingMouseStartY;
    // units
    var objectDefinition = getObjectDefinition(object.id);
    var coordinateSystem = gameDefinition.coordinateSystems[objectDefinition.coordinateSystem];
    var objectNewX = object.x + dx / coordinateSystem.unitWidth;
    var objectNewY = object.y + dy / coordinateSystem.unitHeight;
    // snapping
    var snapX = objectDefinition.snapX || 0;
    var snapY = objectDefinition.snapY || 0;
    var minX = coordinateSystem.minX != null ? coordinateSystem.minX : -Infinity;
    var maxX = coordinateSystem.maxX != null ? coordinateSystem.maxX :  Infinity;
    var minY = coordinateSystem.minY != null ? coordinateSystem.minY : -Infinity;
    var maxY = coordinateSystem.maxY != null ? coordinateSystem.maxY :  Infinity;
    if (minX - snapX <= objectNewX && objectNewX < maxX + snapX &&
        minY - snapY <= objectNewY && objectNewY < maxY + snapY) {
      objectNewX = roundToFactor(objectNewX, objectDefinition.snapX);
      objectNewY = roundToFactor(objectNewY, objectDefinition.snapY);
    }

    if (!(draggingObjectNewX === objectNewX &&
          draggingObjectNewY === objectNewY)) {
      draggingObjectNewX = objectNewX;
      draggingObjectNewY = objectNewY;
      render(object);
    }
  }
});
mainDiv.addEventListener("contextmenu", function(event) {
 event.preventDefault();
});

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
    case "F".charCodeAt(0):
      if (draggingObject != null && modifierMask === 0) { flipDraggingObject(); break; }
      return;
    case "Z".charCodeAt(0):
      if (draggingObject == null && modifierMask === CTRL)       { undo(); break; }
      if (draggingObject == null && modifierMask === CTRL|SHIFT) { redo(); break; }
      return;
    case "Y".charCodeAt(0):
      if (modifierMask === CTRL) { redo(); break; }
      return;
    default: return;
  }
  event.preventDefault();
});

function flipDraggingObject() {
  var objectDefinition = getObjectDefinition(draggingObject.id);
  draggingObjectNewFaceIndex += 1;
  if(objectDefinition.faces.length === draggingObjectNewFaceIndex){
    draggingObjectNewFaceIndex = 0;
  }
  render(draggingObject);
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
  render(object);

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

function render(object) {
  var x = object.x;
  var y = object.y;
  var z = object.z;
  var faceIndex = object.faceIndex;
  if (object === draggingObject) {
    x = draggingObjectNewX;
    y = draggingObjectNewY;
    z = draggingObjectNewZ;
    faceIndex = draggingObjectNewFaceIndex;
  }
  var objectImg = document.getElementById(object.id);
  var objectDefinition = getObjectDefinition(object.id);
  objectImg.src = objectDefinition.faces[faceIndex];
  var coordinateSystem = gameDefinition.coordinateSystems[objectDefinition.coordinateSystem];
  objectImg.style.width = coordinateSystem.unitWidth * objectDefinition.width;
  objectImg.style.height = coordinateSystem.unitHeight * objectDefinition.height;
  objectImg.style.left = coordinateSystem.x + coordinateSystem.unitWidth * x;
  objectImg.style.top = coordinateSystem.y + coordinateSystem.unitHeight * y;
  objectImg.style.zIndex = z;
}

function getObjectsInZOrder() {
  var objects = [];
  for (var objectId in objectsById) {
    objects.push(objectsById[objectId]);
  }
  objects.sort(compareZ);
  return objects;
}
function compareZ(a, b) {
  return operatorCompare(a.z, b.z);
}
function operatorCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function moveObject(object, x, y, z, faceIndex) {
  var args = {
    id: object.id,
    from: {
      x: object.x,
      y: object.y,
      z: object.z,
      faceIndex: object.faceIndex,
    },
    to: {
      x: x,
      y: y,
      z: z,
      faceIndex: faceIndex,
    },
  };
  sendCommand("moveObject", args);
  // anticipate
  object.x = x;
  object.y = y;
  object.z = z;
  object.faceIndex = faceIndex;
  render(object);
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
function sendCommand(cmd, args) {
  var message = {cmd:cmd, user:userName, args:args};
  pushChangeToHistory(message);
  sendMessage(message);
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
      setGameDefinition();
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
      render(object);
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
