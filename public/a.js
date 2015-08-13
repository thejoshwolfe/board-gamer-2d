var mainDiv = document.getElementById("mainDiv");
var cards = [];
var cardById = {};
var mousedCard;
var xstart;
var ystart;
var userName;

function createCard(id, x, y) {
  var card = {id:id, x:x, y:y};
  cards.push(card);
  cardById[id] = card;
  // create the html element, but don't position it until we call render()
  var src = "su.png";
  mainDiv.insertAdjacentHTML("beforeend",
    '<img id="'+id+'" class="gameObject" src="'+src+'">');
}
mainDiv.addEventListener("mousedown", function(event) {
  var x = eventToMouseX(event, mainDiv);
  var y = eventToMouseY(event, mainDiv);
  if (event.button === 0) {
    for (var i = cards.length - 1; i >= 0; i--) {
      var card = cards[i];
      if (x > card.x && x < card.x + deckProperties.width &&
          y > card.y && y < card.y + deckProperties.height) {
        mousedCard = card;
        xstart = x;
        ystart = y;
        cards.splice(i, 1);
        cards.push(card);
        break;
      }
    }
  }
  if (event.button === 2) {
    var id = generateRandomId()
    sendCommand("createCard", {id:id, x:x, y:y});
    createCard(id, x, y);
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
    sendCommand("moveCard", {id:mousedCard.id, x:mousedCard.x, y:mousedCard.y});
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
    console.log(event.data);
    var message = JSON.parse(event.data);
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
}
function sendCommand(cmd, args) {
  socket.send(JSON.stringify({cmd:cmd, args:args, user:userName}));
}
function handleMessage(message) {
  if (message.user === userName) return;
  switch (message.cmd) {
    case "createCard":
      createCard(message.args.id, message.args.x, message.args.y);
      render();
      break;
    case "moveCard":
      var card = cardById[message.args.id];
      card.x = message.args.x;
      card.y = message.args.y;
      render();
      break;
    case "login":
      userName = message.args;
      break;
    default:
      console.log("you broke it son.");
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
