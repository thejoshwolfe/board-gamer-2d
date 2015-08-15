var mainDiv = document.getElementById("mainDiv");
var userName = null;

var gameDefinition;
var objectsById;
function initObjects() {
  objectsById = {};
  for (var id in gameDefinition.objects) {
    var objectDefinition = gameDefinition.objects[id];
    var object = {
      id: id,
      x: objectDefinition.x,
      y: objectDefinition.y,
      z: objectDefinition.z,
    };
    objectsById[id] = object;

    var src = objectDefinition.front;
    mainDiv.insertAdjacentHTML("beforeend", '<img id="'+id+'" class="gameObject" src="'+src+'">');
    var objectImg = document.getElementById(object.id);
    objectImg.addEventListener("mousedown", onObjectMouseDown);
    render(object);
  }
}
function getObjectDefinition(object) {
  return gameDefinition.objects[object.id];
}

function deleteEverything() {
  mainDiv.innerHTML = "";
  userName = null;
  gameDefinition = null;
  objectsById = null;
}
function bringToTop(object) {
  var objects = getObjectsInZOrder();
  if (objects[objects.length - 1] !== object) {
    object.z = objects[objects.length - 1].z + 1;
  }
}

var draggingObject;
var draggingObjectStartX;
var draggingObjectStartY;
var draggingObjectStartZ;
var draggingMouseStartX;
var draggingMouseStartY;
function onObjectMouseDown(event) {
  event.preventDefault();
  var objectId = this.id;
  var object = objectsById[objectId];
  if (getObjectDefinition(object).movable === false) return;

  // begin drag
  var x = eventToMouseX(event, mainDiv);
  var y = eventToMouseY(event, mainDiv);
  draggingObject = object;
  draggingObjectStartX = object.x;
  draggingObjectStartY = object.y;
  draggingObjectStartZ = object.z;
  draggingMouseStartX = x;
  draggingMouseStartY = y;

  bringToTop(object);
  render(object);
}
document.addEventListener("mouseup", function(event) {
  if (draggingObject != null) {
    if (!(draggingObject.x === draggingObjectStartX &&
          draggingObject.y === draggingObjectStartY &&
          draggingObject.z === draggingObjectStartZ)) {
      objectWasMoved(draggingObject);
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
    var objectDefinition = getObjectDefinition(object);
    var coordinateSystem = gameDefinition.coordinateSystems[objectDefinition.coordinateSystem];
    var objectNewX = draggingObjectStartX + dx / coordinateSystem.unitWidth;
    var objectNewY = draggingObjectStartY + dy / coordinateSystem.unitHeight;
    if (objectDefinition.snapX != null) objectNewX = roundToFactor(objectNewX, objectDefinition.snapX);
    if (objectDefinition.snapY != null) objectNewY = roundToFactor(objectNewY, objectDefinition.snapY);
    if (!(object.x === objectNewX &&
          object.y === objectNewY)) {
      object.x = objectNewX;
      object.y = objectNewY;
      render(object);
    }
  }
});
mainDiv.addEventListener("contextmenu", function(event) {
 event.preventDefault();
});

function eventToMouseX(event, mainDiv) { return event.clientX - mainDiv.getBoundingClientRect().left; }
function eventToMouseY(event, mainDiv) { return event.clientY - mainDiv.getBoundingClientRect().top; }

function render(object) {
  var objectImg = document.getElementById(object.id);
  var objectDefinition = getObjectDefinition(object);
  var coordinateSystem = gameDefinition.coordinateSystems[objectDefinition.coordinateSystem];
  objectImg.style.width = coordinateSystem.unitWidth * objectDefinition.width;
  objectImg.style.height = coordinateSystem.unitHeight * objectDefinition.height;
  objectImg.style.left = coordinateSystem.x + coordinateSystem.unitWidth * object.x;
  objectImg.style.top = coordinateSystem.y + coordinateSystem.unitHeight * object.y;
  objectImg.style.zIndex = object.z;
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
function objectWasMoved(object) {
  sendCommand("moveObject", {id:object.id, x:object.x, y:object.y, z:object.z});
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
  socket.send(JSON.stringify({cmd:cmd, user:userName, args:args}));
}
function handleMessage(message) {
  if (message.user === userName) return;
  switch (message.cmd) {
    case "login":
      userName = message.args;
      break;
    case "game":
      gameDefinition = message.args;
      initObjects();
      break;
    case "multi":
      message.args.forEach(handleMessage);
      break;
    case "moveObject":
      var object = objectsById[message.args.id];
      object.x = message.args.x;
      object.y = message.args.y;
      object.z = message.args.z;
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
  return Math.round(n / factor) * factor;
}

connectToServer();
