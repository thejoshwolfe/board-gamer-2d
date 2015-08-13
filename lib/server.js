var http = require("http");
var express = require("express");
var createGzipStatic = require("connect-static");
var yawl = require("yawl");
var allClients = [];
var userId = 0;
var cards = [];
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
      console.log("web socket client connected");
      allClients.push(socket);

      console.log(userId++);
      socket.sendText(JSON.stringify({cmd:"login", args:userId,user:0}));
      cards.forEach(function(card){
        socket.sendText(JSON.stringify({cmd:"createCard", args:card,user:0}));
      });

      socket.on("textMessage", function(msg) {
        // just blast it out verbatim for now
        console.log(msg);
        var message = JSON.parse(msg);
        switch(message.cmd){
          case "createCard":
            var card = {id:message.args.id, x:message.args.x, y:message.args.y};
            cards.push(card);
            cardsById[card.id] = card;
            break;
          case "moveCard":
            var card = cardsById[message.args.id];
            card.x = message.args.x;
            card.y = message.args.y;
            break;
          default:
            console.log("you broke it son.");
        }
        allClients.forEach(function(socket) {
          socket.sendText(msg);
        });
      });
      socket.on('error', function(err) {
        console.log("web socket error:", err.stack);
        removeFromArray(allClients, socket);
      });
      socket.on('close', function() {
        console.log("web socket client disconnected");
        removeFromArray(allClients, socket);
      });
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
