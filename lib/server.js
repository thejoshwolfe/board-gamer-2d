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
  //      role: "red",
  //      socket: socket,
  //    },
  //  },
  //  changeHistory: [
  //    message, ...
  //  ],
  //  unusedTimeoutHandle: null || setTimeout(),
  //},
};

function newRoom() {
  var room = {
    id: generateRoomCode(),
    game: checkersGame,
    usersById: {},
    changeHistory: [],
    unusedTimeoutHandle: null,
  };
  roomsById[room.id] = room;
  return room;
}
var STALE_ROOM_TIMEOUT = 1*60*60*1000; // 1 hour
function checkForNoUsers(room) {
  for (var id in room.usersById) {
    // nevermind. it's not empty.
    return;
  }
  // No, Mr. Room. I expect you to die.
  room.unusedTimeoutHandle = setTimeout(function() {
    console.log("deleting stale room:", room.id);
    delete roomsById[room.id];
  }, STALE_ROOM_TIMEOUT);
}

function findAvailableRole(room) {
  for (var i = 0; i < room.game.roles.length; i++) {
    var roleId = room.game.roles[i].id;
    var used = false;
    for (var userId in room.usersById) {
      var user = room.usersById[userId];
      if (user.role === roleId) {
        used = true;
        break;
      }
    }
    if (!used) return roleId;
  }
  return ""; // spectator
}

function newUser(room, userName, socket) {
  var role = findAvailableRole(room);
  var user = {
    id: generateUserId(),
    userName: userName,
    role: role,
    socket: socket,
  };
  room.usersById[user.id] = user;
  if (room.unusedTimeoutHandle != null) {
    // hold the phone. we've got someone interested after all.
    clearTimeout(room.unusedTimeoutHandle);
    room.unusedTimeoutHandle = null;
  }
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
          return ["joinRoom"];
        case CLIENT_STATE_PLAY:
          return ["makeAMove", "changeMyName", "changeMyRole"];
        default: throw asdf;
      }
    })();
    var message = parseAndValidateMessage(msg, allowedCommands);
    if (message == null) return;

    switch (message.cmd) {
      case "joinRoom":
        var roomCode = message.args.roomCode;
        if (roomCode === "new") {
          room = newRoom();
          user = newUser(room, "Creator", socket);
        } else {
          var possibleRoom = roomsById[roomCode];
          if (possibleRoom == null) {
            // sorry buddy
            sendMessage({cmd:"badRoomCode"});
            // goodbye
            disconnect();
            return;
          }
          room = possibleRoom;
          user = newUser(room, "Anonymous", socket);
        }
        var users = [];
        for (var id in room.usersById) {
          if (id === user.id) continue;
          var otherUser = room.usersById[id];
          users.push({
            id:       otherUser.id,
            userName: otherUser.userName,
            role:     otherUser.role,
          });
          // nice to meet you
          otherUser.socket.sendText(JSON.stringify({cmd:"userJoined", args:{
            id:       user.id,
            userName: user.userName,
            role:     user.role,
          }}));
        }
        sendMessage({cmd:"joinRoom", args:{
          roomCode: room.id,
          userId:   user.id,
          userName: user.userName,
          role:     user.role,
          game:     room.game,
          history:  room.changeHistory,
          users:    users,
        }});
        clientState = CLIENT_STATE_PLAY;
        break;
      case "makeAMove":
        msg = JSON.stringify(message);
        for (var otherId in room.usersById) {
          if (otherId === user.id) continue;
          room.usersById[otherId].socket.sendText(msg);
        }
        room.changeHistory.push(message.args);
        break;
      case "changeMyName":
        var newName = message.args;
        user.userName = newName;
        for (var id in room.usersById) {
          if (id === user.id) continue;
          room.usersById[id].socket.sendText(JSON.stringify({cmd:"changeMyName", args:{
            id:       user.id,
            userName: user.userName,
          }}));
        }
        break;
      case "changeMyRole":
        var newRole = message.args;
        user.role = newRole;
        for (var id in room.usersById) {
          if (id === user.id) continue;
          room.usersById[id].socket.sendText(JSON.stringify({cmd:"changeMyRole", args:{
            id:   user.id,
            role: user.role,
          }}));
        }
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
      // see you guys later
      for (var id in room.usersById) {
        if (id === user.id) continue;
        var otherUser = room.usersById[id];
        otherUser.socket.sendText(JSON.stringify({cmd:"userLeft", args:{id: user.id}}));
      }
      delete room.usersById[user.id];
      checkForNoUsers(room);
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
    // TODO: rethink validation so that it only protects the server, not other clients
    if (typeof message != "object") return failValidation("JSON root data type expected to be object");
    // ignore all unexpected fields.
    message = {
      cmd: message.cmd,
      args: message.args,
    };
    if (allowedCommands.indexOf(message.cmd) === -1) return failValidation("invalid command", message.cmd);
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
      case "makeAMove":
        var move = message.args;
        if (!Array.isArray(move)) return failValidation("expected args to be an array");
        break;
      case "changeMyName":
        var newName = message.args;
        if (typeof newName !== "string") return failValidation("expected string:", newName);
        if (newName.length > 16) newName = newName.substring(0, 16);
        if (newName.length === 0) return failValidation("new name is empty string");
        message.args = newName;
        break;
      case "changeMyRole":
        var newRole = message.args;
        if (typeof newRole !== "string") return failValidation("expected string:", newRole);
        message.args = newRole;
        break;
      default: throw new Error("TODO: handle command: " + message.cmd);
    }

    // seems legit
    return message;

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

var roomCodeAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
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
