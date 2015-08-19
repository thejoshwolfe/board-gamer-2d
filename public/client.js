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
    var objectDefinition = getObjectDefinition(id);
    if (objectDefinition.prototype) continue;
    if (objectDefinition.faces != null) objectDefinition.faces.forEach(preloadImagePath);
    var object = {
      id: id,
      x: objectDefinition.x,
      y: objectDefinition.y,
      z: objectDefinition.z || 0,
      faceIndex: 0,
    };
    objectsById[id] = object;
    if (objectDefinition.snapZones != null) objectsWithSnapZones.push(object);

    mainDiv.insertAdjacentHTML("beforeend", '<canvas id="'+id+'" class="gameObject" style="display:none;"></canvas>');
    var objectDiv = document.getElementById(object.id);
    objectDiv.addEventListener("mousedown", onObjectMouseDown);
    objectDiv.addEventListener("mousemove", onObjectMouseMove);
    objectDiv.addEventListener("mouseout", onObjectMouseOut);
  }
  var objectsInZOrder = getObjectsInZOrder();
  // and now reassign all the z's to be unique
  objectsInZOrder.forEach(function(object, i) {
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
  getObjectsInZOrder().forEach(render);
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

var hoverObject;
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
  var objectDiv = this;
  var object = objectsById[objectDiv.id];
  if (getObjectDefinition(object.id).movable === false) return;

  // begin drag
  objectDiv.classList.add("instantMove");
  if (hoverObject != null) {
    document.getElementById(hoverObject.id).classList.remove("hoverSelect");
  }
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
function onObjectMouseMove(event) {
  var objectDiv = this;
  var object = objectsById[objectDiv.id];
  if (getObjectDefinition(object.id).movable === false) return;
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

document.addEventListener("mouseup", function(event) {
  if (draggingObject != null) {
    if (!(draggingObject.x === draggingObjectNewX &&
          draggingObject.y === draggingObjectNewY &&
          draggingObject.z === draggingObjectNewZ &&
          draggingObject.faceIndex === draggingObjectNewFaceIndex)) {
      moveObject(draggingObject, draggingObjectNewX, draggingObjectNewY, draggingObjectNewZ, draggingObjectNewFaceIndex);

      var objectDiv = document.getElementById(draggingObject.id);
      objectDiv.classList.remove("instantMove");
    }
    draggingObject = null;
    if (hoverObject != null) {
      // back to just hovering
      document.getElementById(hoverObject.id).classList.add("hoverSelect");
    }
  }
});
document.addEventListener("mousemove", function(event) {
  if (draggingObject != null) {
    var object = draggingObject;
    // pixels
    var x = eventToMouseX(event, mainDiv);
    var y = eventToMouseY(event, mainDiv);
    var dx = x - draggingMouseStartX;
    var dy = y - draggingMouseStartY;
    // units
    var objectDefinition = getObjectDefinition(object.id);
    var objectNewX = object.x + dx / gameDefinition.coordinates.unitWidth;
    var objectNewY = object.y + dy / gameDefinition.coordinates.unitHeight;
    // snap zones
    (function() {
      objectsWithSnapZones.sort(compareZ);
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

    if (!(draggingObjectNewX === objectNewX &&
          draggingObjectNewY === objectNewY)) {
      draggingObjectNewX = objectNewX;
      draggingObjectNewY = objectNewY;
      render(object);
    }
  }
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
    case "R".charCodeAt(0):
      if (draggingObject != null && modifierMask === 0) { rollDraggingObject(); break; }
      return;
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
function rollDraggingObject() {
  var objectDefinition = getObjectDefinition(draggingObject.id);
  draggingObjectNewFaceIndex = Math.floor(Math.random() * objectDefinition.faces.length);
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
  var objectDiv = document.getElementById(object.id);
  var objectDefinition = getObjectDefinition(object.id);
  var facePath = objectDefinition.faces[faceIndex];
  var pixelX = mainDiv.offsetLeft + gameDefinition.coordinates.originX + gameDefinition.coordinates.unitWidth  * x;
  var pixelY = mainDiv.offsetTop  + gameDefinition.coordinates.originY + gameDefinition.coordinates.unitHeight * y;
  var pixelWidth = gameDefinition.coordinates.unitWidth * objectDefinition.width;
  var pixelHeight = gameDefinition.coordinates.unitHeight * objectDefinition.height;
  var entry = imageCache[facePath];
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
