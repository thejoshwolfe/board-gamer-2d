import { programmerError } from "./math.js";
import { initGame, deleteTableAndEverything, makeAMove } from "./client.js";
import { ScreenMode, getScreenMode, setScreenMode, renderUserList } from "./ui_layout.js";

import { UserInfo, UserId, JoinRoomArgs, UserJoinedArgs, UserLeftArgs, ChangeMyNameArgs, ChangeMyRoleArgs, RoleId } from "../shared/protocol.js";
import { ProtocolMessage } from "../shared/generated-schema.js";

let socket: WebSocket | null = null;
let isConnected = false;
let roomCode: string | null = null;
let myUser: UserInfo | null = null;
let usersById: {[index: UserId]: UserInfo} = {};

export function sendMessage(message: ProtocolMessage) {
  if (socket == null) programmerError();
  socket.send(JSON.stringify(message));
}

export function getRoomCode() {
  return roomCode ?? programmerError();
}
export function getMyUserId(): UserId {
  return (myUser ?? programmerError()).id;
}
export function getMyUserRole(): RoleId {
  return (myUser ?? programmerError()).role;
}
export function getMyUserDisplayName(): string {
  return (myUser ?? programmerError()).userName;
}

export function setMyUserDisplayName(newName: string) {
  if (newName === "" || newName === myUser!.userName) return;
  sendMessage({
    cmd: "changeMyName",
    args: newName,
  });
  // anticipate
  myUser!.userName = newName;
  renderUserList(usersById, myUser!);
}
export function setMyUserRole(role: RoleId) {
  if (role === myUser!.role) return;
  sendMessage({
    cmd: "changeMyRole",
    args: role,
  });
  // anticipate
  myUser!.role = role;
  renderUserList(usersById, myUser!);
}

export function connectToServer(newRoomCode: string | null) {
  roomCode = newRoomCode;
  setScreenMode(ScreenMode.WAITING_FOR_SERVER_CONNECT);

  socket = makeWebSocket();
  socket.addEventListener('open', onOpen, false);
  socket.addEventListener('message', onMessage, false);
  socket.addEventListener('error', timeoutThenCreateNew, false);
  socket.addEventListener('close', timeoutThenCreateNew, false);

  function onOpen() {
    isConnected = true;
    console.log("connected");
    let roomCodeToSend = roomCode;
    if (roomCode != null) {
      roomCodeToSend = roomCode;
      setScreenMode(ScreenMode.WAITING_FOR_ROOM_CODE_CONFIRMATION);
    } else {
      roomCodeToSend = "new";
      setScreenMode(ScreenMode.WAITING_FOR_CREATE_ROOM);
    }
    sendMessage({
      cmd: "joinRoom",
      args: {
        roomCode: roomCodeToSend,
      },
    });
  }
  function onMessage(event: MessageEvent) {
    let msg = event.data;
    if (msg === "keepAlive") return;
    let message = JSON.parse(msg) as { cmd: string, args?: any };
    console.log(message);
    let screenMode = getScreenMode();
    if (screenMode === ScreenMode.WAITING_FOR_ROOM_CODE_CONFIRMATION && message.cmd === "badRoomCode") {
      // nice try
      disconnect();
      setScreenMode(ScreenMode.LOGIN);
      // TODO: show message that says we tried
      return;
    }
    switch (screenMode) {
      case ScreenMode.WAITING_FOR_CREATE_ROOM:
      case ScreenMode.WAITING_FOR_ROOM_CODE_CONFIRMATION:
        if (message.cmd === "joinRoom") {
          setScreenMode(ScreenMode.PLAY);
          let args = message.args as JoinRoomArgs;
          roomCode = args.roomCode;
          myUser = {
            id: args.userId,
            userName: args.userName,
            role: args.role,
          };
          usersById[myUser.id] = myUser;
          args.users.forEach(function(otherUser) {
            usersById[otherUser.id] = otherUser;
          });
          initGame(args.database, args.game, args.history);
          renderUserList(usersById, myUser);
        } else programmerError();
        break;
      case ScreenMode.PLAY:
        if (message.cmd === "makeAMove") {
          makeAMove(message.args, true);
        } else if (message.cmd === "userJoined") {
          let args = message.args as UserJoinedArgs;
          usersById[args.id] = {
            id: args.id,
            userName: args.userName,
            role: args.role,
          };
          renderUserList(usersById, myUser!);
        } else if (message.cmd === "userLeft") {
          let args = message.args as UserLeftArgs;
          delete usersById[args.id];
          renderUserList(usersById, myUser!);
        } else if (message.cmd === "changeMyName") {
          let args = message.args as ChangeMyNameArgs;
          usersById[args.id].userName = args.userName;
          renderUserList(usersById, myUser!);
        } else if (message.cmd === "changeMyRole") {
          let args = message.args as ChangeMyRoleArgs;
          usersById[args.id].role = args.role;
          renderUserList(usersById, myUser!);
        }
        break;
      default: programmerError();
    }
  }
  function timeoutThenCreateNew() {
    removeListeners();
    if (isConnected) {
      isConnected = false;
      console.log("disconnected");
      deleteTableAndEverything();
      usersById = {};
      setScreenMode(ScreenMode.DISCONNECTED);
    }
    setTimeout(connectToServer, 1000);
  }
  function disconnect() {
    if (socket == null) programmerError();
    console.log("disconnect");
    removeListeners();
    socket.close();
    isConnected = false;
  }
  function removeListeners() {
    if (socket == null) programmerError();
    socket.removeEventListener('open', onOpen, false);
    socket.removeEventListener('message', onMessage, false);
    socket.removeEventListener('error', timeoutThenCreateNew, false);
    socket.removeEventListener('close', timeoutThenCreateNew, false);
  }
}

function makeWebSocket(): WebSocket {
  let host = location.host;
  let pathname = location.pathname;
  let isHttps = location.protocol === "https:";
  let match = host.match(/^(.+):(\d+)$/);
  let defaultPort = isHttps ? 443 : 80;
  let port = match ? parseInt(match[2], 10) : defaultPort;
  let hostName = match ? match[1] : host;
  let wsProto = isHttps ? "wss:" : "ws:";
  let wsUrl = wsProto + "//" + hostName + ":" + port + pathname;
  return new WebSocket(wsUrl);
}
