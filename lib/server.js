var http = require("http");
var express = require("express");
var createGzipStatic = require("connect-static");
var yawl = require("yawl");

var checkersGame = require("./checkers");
var changeHistory = [];

var allClients = [];
var totalUserIds = 0;

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
      // tell them what game we're playing
      socket.sendText(JSON.stringify({cmd:"game", user:0, args:checkersGame}));
      // catch them up on the state of the game
      socket.sendText(JSON.stringify({cmd:"multi", user:0, args:changeHistory}));

      socket.on("textMessage", function(msg) {
        console.log(msg);
        allClients.forEach(function(socket) {
          socket.sendText(msg);
        });
        changeHistory.push(JSON.parse(msg));
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
