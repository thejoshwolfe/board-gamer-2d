var mainDiv = document.getElementById("mainDiv");
var cardsById = {};
var mousedCard;
var xstart;
var ystart;
var userName = null;
var maxZ = 0;

function createCard(id, x, y, z) {
  var card = {id:id, x:x, y:y, z:z};
  cardsById[id] = card;
  maxZ = Math.max(maxZ, card.z);
  // create the html element, but don't position it until we call render()
  var src = "su.png";
  mainDiv.insertAdjacentHTML("beforeend",
    '<img id="'+id+'" class="gameObject" src="'+src+'">');
}
function deleteEverything() {
  mainDiv.innerHTML = "";
  cardsById = {};
  userName = null;
  maxZ = 0;
}
mainDiv.addEventListener("mousedown", function(event) {
  var x = eventToMouseX(event, mainDiv);
  var y = eventToMouseY(event, mainDiv);
  if (event.button === 0) {
    var cards = getCards();
    for (var i = cards.length - 1; i >= 0; i--) {
      var card = cards[i];
      if (x > card.x && x < card.x + deckProperties.width &&
          y > card.y && y < card.y + deckProperties.height) {
        mousedCard = card;
        xstart = x;
        ystart = y;
        // bring to top
        maxZ++;
        card.z = maxZ;
        cardWasMoved(card);
        break;
      }
    }
  }
  if (event.button === 2) {
    var id = generateRandomId()
    maxZ++;
    var z = maxZ;
    sendCommand("createCard", {id:id, x:x, y:y, z:z});
    createCard(id, x, y, z);
  }
  event.preventDefault();
  render();
});
mainDiv.addEventListener("contextmenu", function(event) {
 event.preventDefault();
});
document.addEventListener("mouseup", function(event) {
  mousedCard = null;
});
mainDiv.addEventListener("mousemove", function(event) {
  if (mousedCard != null) {
    var x = eventToMouseX(event, mainDiv);
    var y = eventToMouseY(event, mainDiv);
    var dx = (x - xstart);
    var dy = (y - ystart);
    xstart = x;
    ystart = y;
    mousedCard.x += dx;
    mousedCard.y += dy;
    cardWasMoved(mousedCard);
    render();
  }
});

function eventToMouseX(event, mainDiv) { return event.clientX - mainDiv.getBoundingClientRect().left; }
function eventToMouseY(event, mainDiv) { return event.clientY - mainDiv.getBoundingClientRect().top; }

var deckProperties = {
  height: 110,
  width: 81,
};

function render() {
  var cards = getCards();
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var cardImg = document.getElementById(card.id);
    cardImg.style.width = deckProperties.width;
    cardImg.style.height = deckProperties.height;
    cardImg.style.left = card.x;
    cardImg.style.top = card.y;
    cardImg.style.zIndex = i;
  }
}

function getCards() {
  var cards = [];
  for (var cardId in cardsById) {
    cards.push(cardsById[cardId]);
  }
  cards.sort(compareZ);
  return cards;
}
function compareZ(a, b) {
  return operatorCompare(a.z, b.z);
}
function operatorCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function cardWasMoved(card) {
  sendCommand("moveCard", {id:card.id, x:card.x, y:card.y, z:card.z});
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
    console.log(msg);
    if (msg === "keepAlive") return;
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
    case "createCard":
      createCard(message.args.id, message.args.x, message.args.y, message.args.z);
      render();
      break;
    case "moveCard":
      var card = cardsById[message.args.id];
      card.x = message.args.x;
      card.y = message.args.y;
      card.z = message.args.z;
      maxZ = Math.max(maxZ, card.z);
      render();
      break;
    case "login":
      userName = message.args;
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

connectToServer();
