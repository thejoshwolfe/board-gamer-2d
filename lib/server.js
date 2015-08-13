var http = require("http");
var express = require("express");
var createGzipStatic = require("connect-static");
var yawl = require("yawl");
var allClients = [];
var userId = 0;

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
      var usersend = {cmd:"login", args:userId,user:0};
      socket.sendText(JSON.stringify(usersend));
      socket.on("textMessage", function(msg) {
        // just blast it out verbatim for now
        console.log(msg);
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
