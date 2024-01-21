import http from "http";
import express from "express";
import {WebSocket, WebSocketServer} from "ws";

import database from "./database";
import defaultRoomState from "./defaultRoom";

function main() {
  var app = express();
  app.use(express.static("../public"));
  var httpServer = http.createServer(app);
  const wss = new WebSocketServer({server: httpServer});
  wss.on("error", function(err) {
    console.log("web socket server error:", err);
  });
  wss.on("connection", function(socket) {
    handleNewSocket(socket);
  });
  httpServer.listen(25407, "127.0.0.1", function() {
    console.log("serving: http://127.0.0.1:25407/");
  });
}

var roomsById: {[index: string]: Room} = {};
interface Room {
  id: string,
  database: any, // TODO
  game: any, // TODO
  usersById: {[index: string]: UserInRoom},
  changeHistory: any[], // TODO
  unusedTimeoutHandle: NodeJS.Timeout | null,
}
interface UserInRoom {
  id: string,
  userName: string,
  role: string,
  socket: WebSocket,
}

function newRoom() {
  var roomState = JSON.parse(JSON.stringify(defaultRoomState));
  var room = {
    id: generateRoomCode(),
    database: database,
    game: roomState,
    usersById: {},
    changeHistory: [],
    unusedTimeoutHandle: null,
  };
  roomsById[room.id] = room;
  return room;
}
var STALE_ROOM_TIMEOUT = 1*60*60*1000; // 1 hour
function checkForNoUsers(room: Room) {
  for (var _id in room.usersById) {
    // nevermind. it's not empty.
    return;
  }
  // No, Mr. Room. I expect you to die.
  room.unusedTimeoutHandle = setTimeout(function() {
    console.log("deleting stale room:", room.id);
    delete roomsById[room.id];
  }, STALE_ROOM_TIMEOUT);
}

function findAvailableRole(room: Room) {
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

function newUser(room: Room, userName: string, socket: WebSocket) {
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
function handleNewSocket(socket: WebSocket) {
  console.log("web socket connected");

  var clientState = CLIENT_STATE_WAITING_FOR_LOGIN;
  var room: Room | null = null;
  var user: UserInRoom | null = null;

  socket.on("message", function(data, isBinary) {
    if (isBinary) throw new Error("no");
    const msg = data.toString();

    if (clientState === CLIENT_STATE_DISCONNECTING) return;
    console.log(msg);
    var allowedCommands = (function() {
      switch (clientState) {
        case CLIENT_STATE_WAITING_FOR_LOGIN:
          return ["joinRoom"];
        case CLIENT_STATE_PLAY:
          return ["makeAMove", "changeMyName", "changeMyRole"];
        default: programmerError();
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
          otherUser.socket.send(JSON.stringify({cmd:"userJoined", args:{
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
          database: database,
          game:     room.game,
          history:  room.changeHistory,
          users:    users,
        }});
        clientState = CLIENT_STATE_PLAY;
        break;
      case "makeAMove": {
        if (!(user != null && room != null)) programmerError();
        let msg = JSON.stringify(message);
        for (var otherId in room.usersById) {
          if (otherId === user.id) continue;
          room.usersById[otherId].socket.send(msg);
        }
        room.changeHistory.push(message.args);
        break;
      }
      case "changeMyName":
        if (!(user != null && room != null)) programmerError();
        var newName = message.args;
        user.userName = newName;
        for (var id in room.usersById) {
          if (id === user.id) continue;
          room.usersById[id].socket.send(JSON.stringify({cmd:"changeMyName", args:{
            id:       user.id,
            userName: user.userName,
          }}));
        }
        break;
      case "changeMyRole":
        if (!(user != null && room != null)) programmerError();
        var newRole = message.args;
        user.role = newRole;
        for (var id in room.usersById) {
          if (id === user.id) continue;
          room.usersById[id].socket.send(JSON.stringify({cmd:"changeMyRole", args:{
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
  socket.on("close", function(code, reason) {
    console.log("web socket client disconnected:", code, reason);
    handleDisconnect();
  });
  let keepAliveHandle: NodeJS.Timeout | null = setInterval(function() {
    try {
      socket.send("keepAlive");
    } catch (e) {}
  }, 10 * 1000);
  function handleDisconnect() {
    clientState = CLIENT_STATE_DISCONNECTING;
    if (user != null) {
      if (room == null) programmerError();
      // see you guys later
      for (var id in room.usersById) {
        if (id === user.id) continue;
        var otherUser = room.usersById[id];
        otherUser.socket.send(JSON.stringify({cmd:"userLeft", args:{id: user.id}}));
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

  function sendMessage(message: any) {
    var msg = JSON.stringify(message);
    socket.send(msg);
  }

  function parseAndValidateMessage(msg: string, allowedCommands: string[]) {
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

    function failValidation(blurb: string | any, offendingValue?: any) {
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
function generateFromAlphabet(length: number, alphabet: string) {
  var result = "";
  for (var i = 0; i < length; i++) {
    var letter = alphabet[Math.floor(Math.random() * alphabet.length)];
    result += letter;
  }
  return result;
}
function programmerError(msg?: string): never { throw new Error(msg); }

main();
