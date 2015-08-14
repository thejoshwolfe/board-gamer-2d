var mainDiv = document.getElementById("mainDiv");
var cardsById = {};
var userName = null;

function createCard(id, x, y, z) {
  var card = {id:id, x:x, y:y, z:z};
  cardsById[id] = card;
  // create the html element, but don't position it until we call render()
  var src = "su.png";
  mainDiv.insertAdjacentHTML("beforeend", '<img id="'+id+'" class="gameObject" src="'+src+'">');
  return card;
}
function deleteEverything() {
  mainDiv.innerHTML = "";
  cardsById = {};
  userName = null;
}
function bringToTop(card) {
  var cards = getCards();
  if (cards[cards.length - 1] !== card) {
    card.z = cards[cards.length - 1].z + 1;
  }
}
function getNewTopCardZ() {
  var cards = getCards();
  if (cards.length === 0) return 0;
  return cards[cards.length - 1].z + 1;
}

var draggingCard;
var draggingCardStartX;
var draggingCardStartY;
var draggingCardStartZ;
var draggingMouseStartX;
var draggingMouseStartY;
mainDiv.addEventListener("mousedown", function(event) {
  if (!isConnected) return;
  var x = eventToMouseX(event, mainDiv);
  var y = eventToMouseY(event, mainDiv);
  if (event.button === 0) {
    var cards = getCards();
    for (var i = cards.length - 1; i >= 0; i--) {
      var card = cards[i];
      if (x > card.x && x < card.x + deckProperties.width &&
          y > card.y && y < card.y + deckProperties.height) {
        draggingCard = card;
        draggingCardStartX = card.x;
        draggingCardStartY = card.y;
        draggingCardStartZ = card.z;
        draggingMouseStartX = x;
        draggingMouseStartY = y;
        // bring to top
        bringToTop(card);
        break;
      }
    }
  }
  if (event.button === 2) {
    var id = generateRandomId()
    var card = createCard(id, x, y, getNewTopCardZ());
    sendCommand("createCard", {id:card.id, x:card.x, y:card.y, z:card.z});
  }
  event.preventDefault();
  render();
});
document.addEventListener("mouseup", function(event) {
  if (draggingCard != null) {
    if (!(draggingCard.x === draggingCardStartX &&
          draggingCard.y === draggingCardStartY &&
          draggingCard.z === draggingCardStartZ)) {
      cardWasMoved(draggingCard);
    }
    draggingCard = null;
  }
});
mainDiv.addEventListener("mousemove", function(event) {
  if (draggingCard != null) {
    var x = eventToMouseX(event, mainDiv);
    var y = eventToMouseY(event, mainDiv);
    var dx = x - draggingMouseStartX;
    var dy = y - draggingMouseStartY;
    draggingCard.x = draggingCardStartX + dx;
    draggingCard.y = draggingCardStartY + dy;
    render();
  }
});
mainDiv.addEventListener("contextmenu", function(event) {
 event.preventDefault();
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
    case "createCard":
      createCard(message.args.id, message.args.x, message.args.y, message.args.z);
      render();
      break;
    case "moveCard":
      var card = cardsById[message.args.id];
      card.x = message.args.x;
      card.y = message.args.y;
      card.z = message.args.z;
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
