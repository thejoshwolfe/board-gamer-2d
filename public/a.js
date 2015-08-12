var canvas = document.getElementById("canvas");
var cards = [];
var mousedCard;
var xstart;
var ystart;

var suImage = new Image();
suImage.src = "su.png";
suImage.addEventListener("load", function() {
  render();
});
function createCard(x, y) {
  sendCommand("createCard", {x:x, y:y});
}
canvas.addEventListener("mousedown", function(event){
  var x = eventToMouseX(event,canvas);
  var y = eventToMouseY(event,canvas);
  if(event.button === 0){
    for(var i = cards.length-1; i>=0;i--){
      var card = cards[i];
      if (x > card.x && x<card.x + deckProperties.width &&
          y > card.y && y<card.y + deckProperties.height) {
        mousedCard = card;
        xstart = x;
        ystart = y;
        cards.splice(i,1);
        cards.push(card);
        break;
      }
    }
  }
  if(event.button === 2){
    createCard(x,y);
  }
  event.preventDefault();
  render();
});
canvas.addEventListener("contextmenu", function(event){
 event.preventDefault();
});
document.addEventListener("mouseup", function(event){
  mousedCard = null;
});
canvas.addEventListener("mousemove", function(event){
  if(mousedCard != null){
    var x = eventToMouseX(event,canvas);
    var y = eventToMouseY(event,canvas);
    var dx = (x - xstart);
    var dy = (y - ystart);
    xstart = x;
    ystart = y;
    mousedCard.x += dx;
    mousedCard.y += dy;
    render();
  }
});

function eventToMouseX(event, canvas) { return event.clientX - canvas.getBoundingClientRect().left; }
function eventToMouseY(event, canvas) { return event.clientY - canvas.getBoundingClientRect().top; }

var cardProperties = {
  cropX: 0,
  cropY: 0,
  cropW: 822,
  cropH: 1122,
};
var deckProperties = {
  height: 110,
  width: 81,
};

function render() {
  var context = canvas.getContext("2d");
  context.fillStyle = "#0a0";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (suImage.complete) {
    for(var i = 0; i<cards.length;i++){
      context.drawImage(suImage,
          cardProperties.cropX, cardProperties.cropY,
          cardProperties.cropW, cardProperties.cropH,
          cards[i].x, cards[i].y,
          deckProperties.width, deckProperties.height
      );
    }
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
  socket.send(JSON.stringify({cmd:"createCard", args:args}));
}
function handleMessage(message) {
  switch (message.cmd) {
    case "createCard":
      cards.push(message.args);
      render();
      break;
  }
}


connectToServer();
