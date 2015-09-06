var http = require("http");
var express = require("express");
var createGzipStatic = require("connect-static");
var yawl = require("yawl");

var checkersGame = require("./checkers");

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
      handleNewSocket(socket);
    });
    httpServer.listen(25407, "127.0.0.1", function(err) {
      console.log("serving: http://127.0.0.1:25407/");
    });
  });
}

var roomsById = {
  //"roomCode": {
  //  id: "roomCode",
  //  game: checkersGame,
  //  usersById: {
  //    "userId": {
  //      id: "userId",
  //      userName: "Josh",
  //      socket: socket,
  //    },
  //  },
  //  changeHistory: [
  //    message, ...
  //  ],
  //},
};

function newRoom() {
  var room = {
    id: generateRoomCode(),
    game: checkersGame,
    usersById: {},
    changeHistory: [],
  };
  roomsById[room.id] = room;
  return room;
}

function newUser(room, userName, socket) {
  var user = {
    id: generateUserId(),
    userName: userName,
    socket: socket,
  };
  room.usersById[user.id] = user;
  return user;
}


var CLIENT_STATE_DISCONNECTING = 0;
var CLIENT_STATE_WAITING_FOR_LOGIN = 1;
var CLIENT_STATE_PLAY = 2;
function handleNewSocket(socket) {
  console.log("web socket connected");

  var clientState = CLIENT_STATE_WAITING_FOR_LOGIN;
  var room;
  var user;

  socket.on("textMessage", function(msg) {
    if (clientState === CLIENT_STATE_DISCONNECTING) return;
    console.log(msg);
    var allowedCommands = (function() {
      switch (clientState) {
        case CLIENT_STATE_WAITING_FOR_LOGIN:
          return ["createRoom", "joinRoom"];
        case CLIENT_STATE_PLAY:
          return ["moveObject", "multi"];
        default: throw asdf;
      }
    })();
    var message = parseAndValidateMessage(msg, allowedCommands);
    if (message == null) return;

    switch (message.cmd) {
      case "createRoom":
        room = newRoom();
        user = newUser(room, "Author", socket);
        sendMessage({cmd:"createRoom", user:0, args:{
          roomCode: room.id,
          userId:   user.id,
          userName: user.userName,
          game:     room.game,
          history:  room.changeHistory,
        }});
        clientState = CLIENT_STATE_PLAY;
        break;
      case "joinRoom":
        var possibleRoom = roomsById[message.args.roomCode];
        if (possibleRoom == null) {
          // sorry buddy
          sendMessage({cmd:"badRoomCode", user:0});
          // goodbye
          disconnect();
          return;
        }
        room = possibleRoom;
        user = newUser(room, "Anonymous", socket);
        sendMessage({cmd:"joinRoom", user:0, args:{
          userId:   user.id,
          userName: user.userName,
          game:     room.game,
          history:  room.changeHistory,
        }});
        clientState = CLIENT_STATE_PLAY;
        break;
      case "moveObject":
      case "multi":
        msg = JSON.stringify(message);
        for (var otherId in room.usersById) {
          room.usersById[otherId].socket.sendText(msg);
        }
        room.changeHistory.push(message);
        break;
      default: throw new Error("TODO: handle command: " + message.cmd);
    }
  });

  function disconnect() {
    // we initiate a disconnect
    socket.close();
    // and anticipate
    handleDisconnect();
  }
  socket.on('error', function(err) {
    console.log("web socket error:", err.stack);
    handleDisconnect();
  });
  socket.on('close', function() {
    console.log("web socket client disconnected");
    handleDisconnect();
  });
  var keepAliveHandle = setInterval(function() {
    try {
      socket.sendText("keepAlive");
    } catch (e) {}
  }, 10 * 1000);
  function handleDisconnect() {
    clientState = CLIENT_STATE_DISCONNECTING;
    if (user != null) {
      delete room.usersById[user.id];
      room = null;
      user = null;
    }
    if (keepAliveHandle != null) {
      clearInterval(keepAliveHandle);
      keepAliveHandle = null;
    }
  }

  function sendMessage(message) {
    var msg = JSON.stringify(message);
    socket.sendText(msg);
  }

  function parseAndValidateMessage(msg, allowedCommands) {
    try {
      var message = JSON.parse(msg);
    } catch (e) {
      return failValidation(e);
    }
    // ignore all unexpected fields.
    message = {
      cmd: message.cmd,
      user: message.user,
      args: message.args,
    };
    message = recursiveValidate(message, 0);
    if (message == null) return null;
    return message;

    function recursiveValidate(message, recursionDepth) {
      if (allowedCommands.indexOf(message.cmd) === -1) return failValidation("invalid command", message.cmd);
      if (user != null && message.user !== user.id) return failValidation("wrong userId:", message.user);
      switch (message.cmd) {
        case "createRoom":
          if (message.args != null) return failValidation("expected no args. got:", message.args);
          delete message.args;
          break;
        case "joinRoom":
          message.args = {
            roomCode: message.args.roomCode,
          };
          if (typeof message.args.roomCode !== "string") return failValidation("expected string:", message.args.roomCode);
          // although the room code might be bogus, that's a reasonable mistake, not a malfunction.
          break;
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
        case "multi":
          if (recursionDepth > 0) return failValidation("nested multi commands");
          if (!Array.isArray(message.args)) return failValidation("args is not an array");
          for (var i = 0; i < message.args.length; i++) {
            var subMessage = recursiveValidate(message.args[i], recursionDepth + 1);
            if (subMessage == null) return null;
            message.args[i] = subMessage;
          }
          break;
        default: throw new Error("TODO: handle command: " + message.cmd);
      }

      // seems legit
      return message;
    }

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
}

// avoid 1I and 0O to make it easier to type
var roomCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function generateRoomCode() {
  return generateFromAlphabet(5, roomCodeAlphabet);
}
var idAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function generateUserId() {
  return generateFromAlphabet(8, idAlphabet);
}
function generateFromAlphabet(length, alphabet) {
  var result = "";
  for (var i = 0; i < length; i++) {
    var letter = alphabet[Math.floor(Math.random() * alphabet.length)];
    result += letter;
  }
  return result;
}

main();
