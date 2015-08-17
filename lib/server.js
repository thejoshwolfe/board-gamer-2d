var http = require("http");
var express = require("express");
var createGzipStatic = require("connect-static");
var yawl = require("yawl");

var checkersGame = require("./checkers");
var changeHistory = [];

var allClients = [];
var totalUserIds = 1;

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
        msg = validateMessage(msg);
        if (msg == null) return;
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
      function validateMessage(msg) {
        try {
          var message = JSON.parse(msg);
        } catch (e) {
          return failValidation(e);
        }
        // ignore all unexpected fields. TODO: error instead?
        message = {
          cmd: message.cmd,
          user: message.user,
          args: message.args,
        };
        if (message.user !== userId) return failValidation("wrong userId:", message.user);
        switch (message.cmd) {
          case "moveObject":
            message.args = {
              id: message.args.id,
              from: message.args.from,
              to: message.args.to,
            };
            var id = message.args.id;
            if (checkersGame.objects[id] == null) return failValidation("bad object id:", id);
            if (checkersGame.objects[id].prototype) return failValidation("can't move a prototype:", id);
            for (var i = 0; i < 2; i++) {
              var groupName = ["from", "to"][i];
              var props = message.args[groupName];
              var x = props.x;
              var y = props.y;
              var z = props.z;
              var faceIndex = props.faceIndex;
              message.args[groupName] = {
                x: x,
                y: y,
                z: z,
                faceIndex: faceIndex,
              };
              if (!isFinite(x)) return failValidation("x is not a number:", x);
              if (!isFinite(y)) return failValidation("y is not a number:", y);
              if (!Number.isInteger(z)) return failValidation("z is not an integer:", z);
              if (!Number.isInteger(faceIndex)) return failValidation("faceIndex is not an integer:", faceIndex);
            }
            break;
          default:
            return failValidation("unrecognized command:", message.cmd);
        }

        // all good
        return JSON.stringify(message);

        function failValidation(blurb, offendingValue) {
          if (arguments.length >= 2) {
            if (typeof offendingValue === "string") {
              // make whitespace easier to see
              offendingValue = JSON.stringify(offendingValue);
            }
            console.log("message failed validation:", blurb, offendingValue);
          } else {
            console.log("message failed validation:", blurb);
          }
          return null;
        }
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
