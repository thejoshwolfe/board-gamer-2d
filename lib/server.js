var http = require("http");
var express = require("express");
var createGzipStatic = require("connect-static");
var yawl = require("yawl");
var allClients = [];
var totalUserIds = 0;
var cardsById = {};

function main() {
  var app = express();
  createGzipStatic({dir:"public"}, function(err, middleware) {
    if (err) throw err;
    app.use(middleware);
    var httpServer = http.createServer(app);
    var webSocketServer = yawl.createServer({
      server: httpServer,
      allowTextMessages: true,
      maxFrameSize: 16 * 1024 * 1024, // 16 MB
      origin: null,
    });
    webSocketServer.on("error", function(err) {
      console.log("web socket server error:", err.stack);
    });
    webSocketServer.on("connection", function(socket) {
      var userId = totalUserIds++;
      console.log("web socket client connected:", userId);
      allClients.push(socket);
      socket.sendText(JSON.stringify({cmd:"login", user:0, args:userId}));
      // catch them up on the state of the game
      for (var cardId in cardsById) {
        var card = cardsById[cardId];
        socket.sendText(JSON.stringify({cmd:"createCard", user:0, args:card}));
      }

      socket.on("textMessage", function(msg) {
        console.log(msg);
        var message = JSON.parse(msg);
        switch(message.cmd){
          case "createCard":
            var card = {id:message.args.id, x:message.args.x, y:message.args.y, z:message.args.z};
            cardsById[card.id] = card;
            break;
          case "moveCard":
            var card = cardsById[message.args.id];
            card.x = message.args.x;
            card.y = message.args.y;
            card.z = message.args.z;
            break;
          default:
            console.log("unknown command:", message.cmd);
        }
        allClients.forEach(function(socket) {
          socket.sendText(msg);
        });
      });
      socket.on('error', function(err) {
        console.log("web socket error:", err.stack);
        handleDisconnect();
      });
      socket.on('close', function() {
        console.log("web socket client disconnected");
        handleDisconnect();
      });
      var keepAliveHandle = setInterval(function() {
        socket.sendText("keepAlive");
      }, 10 * 1000);
      function handleDisconnect() {
        if (keepAliveHandle == null) return;
        clearInterval(keepAliveHandle);
        keepAliveHandle = null;
        removeFromArray(allClients, socket);
      }
    });
    httpServer.listen(25407, "127.0.0.1", function(err) {
      console.log("serving: http://127.0.0.1:25407/");
    });
  });
}

function removeFromArray(array, element) {
  var index = array.indexOf(element);
  if (index === -1) return;
  array.splice(index, 1);
}

main();
