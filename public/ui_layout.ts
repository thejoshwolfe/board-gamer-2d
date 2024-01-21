import {
  getMyUserRole, getMyUserDisplayName, setMyUserDisplayName, setMyUserRole, connectToServer,
} from "./connection.js";
import {
  UserInfo, UserId,
} from "./protocol.js";
import {
  fixFloatingThingZ, renderAllObjects, renderPlayerLabelObjects,
  getRoles,
  renderCloset,
  isDraggingAnything,
} from "./client.js";
import { programmerError } from "./math.js";

const userListUl = document.getElementById("userListUl") as HTMLUListElement;
export function renderUserList(usersById: {[index: UserId]: UserInfo}, myUser: UserInfo) {
  let userIds = Object.keys(usersById);
  userIds.sort();
  userListUl.innerHTML = userIds.map(function(userId) {
    return (
      '<li'+(userId === myUser.id ? ' id="myUserNameLi" title="Click to edit your name/role"' : '')+'>' +
        sanitizeHtml(usersById[userId].userName) +
      '</li>'
    );
  }).join("");

  renderPlayerLabelObjects(usersById, userIds, myUser);
  const myUserNameLi = document.getElementById("myUserNameLi") as HTMLLIElement;
  myUserNameLi.addEventListener("click", showEditUserDialog);
}

let dialogIsOpen = false;
export function isDialogOpen() { return dialogIsOpen; }
const modalMaskDiv = document.getElementById("modalMaskDiv") as HTMLDivElement;
modalMaskDiv.addEventListener("mousedown", closeDialog);
const editUserDiv = document.getElementById("editUserDiv") as HTMLDivElement;
function showEditUserDialog() {
  modalMaskDiv.style.display = "block";
  editUserDiv.style.display = "block";

  yourNameTextbox.value = getMyUserDisplayName();
  yourRoleDropdown.innerHTML = '<option value="">Spectator</option>' + getRoles().map(function(role) {
    return '<option value="'+role.id+'">' + sanitizeHtml(role.name) + '</option>';
  }).join("");
  yourRoleDropdown.value = getMyUserRole();

  dialogIsOpen = true;
  yourNameTextbox.focus();
  yourNameTextbox.select();
}
export function closeDialog() {
  modalMaskDiv.style.display = "none";
  editUserDiv.style.display = "none";
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  dialogIsOpen = false;
}
const yourNameTextbox = document.getElementById("yourNameTextbox") as HTMLInputElement;
yourNameTextbox.addEventListener("keydown", function(event) {
  event.stopPropagation();
  if (event.keyCode === 13) {
    setTimeout(function() {
      submitYourName();
      closeDialog();
    }, 0);
  } else if (event.keyCode === 27) {
    setTimeout(closeDialog, 0);
  }
});
const submitYourNameButton = document.getElementById("submitYourNameButton") as HTMLInputElement;
submitYourNameButton.addEventListener("click", submitYourName);
function submitYourName() {
  setMyUserDisplayName(yourNameTextbox.value);
}
const yourRoleDropdown = document.getElementById("yourRoleDropdown") as HTMLSelectElement;
yourRoleDropdown.addEventListener("change", function() {
  setTimeout(function() {
    setMyUserRole(yourRoleDropdown.value);
    // hide/show objects
    renderAllObjects();
    fixFloatingThingZ();
  }, 0);
});
const closeEditUserButton = document.getElementById("closeEditUserButton") as HTMLInputElement;
closeEditUserButton.addEventListener("click", closeDialog);

const moveLockedObjectsModeCheckbox = document.getElementById("moveLockedObjectsModeCheckbox") as HTMLInputElement;
moveLockedObjectsModeCheckbox.addEventListener("click", function() {
  // Prevent keyboard focus from interfering with hotkeys.
  moveLockedObjectsModeCheckbox.blur();
});

export function canMoveLockedObjects(): boolean {
  return moveLockedObjectsModeCheckbox.checked;
}

function sanitizeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

let isHelpShown = true;
let isHelpMouseIn = false;
export function toggleHelp() {
  isHelpShown = !isHelpShown;
  renderHelp();
}
const topRightDiv = document.getElementById("topRightDiv") as HTMLDivElement;
const helpDiv = document.getElementById("helpDiv") as HTMLDivElement;
helpDiv.addEventListener("mousemove", function() {
  if (isDraggingAnything()) return;
  isHelpMouseIn = true;
  renderHelp();
});
helpDiv.addEventListener("mouseout", function() {
  isHelpMouseIn = false;
  renderHelp();
});
function renderHelp() {
  if (isHelpShown || isHelpMouseIn) {
    helpDiv.classList.add("helpExpanded");
  } else {
    helpDiv.classList.remove("helpExpanded");
  }
}

let showCloset = false;

const closetDiv = document.getElementById("closetDiv") as HTMLDivElement;
const closetShowHideButton = document.getElementById("closetShowHideButton") as HTMLParagraphElement;
const closetUl = document.getElementById("closetUl") as HTMLUListElement;
closetShowHideButton.addEventListener("click", function(event) {
  event.preventDefault();
  if (event.button !== 0) return;
  event.stopPropagation();
  if (showCloset) {
    closetUl.innerHTML = "";
    showCloset = false;
    return;
  }
  showCloset = true;
  renderCloset(closetUl);
});

export function setOverlayZ(z: number) {
  topRightDiv .style.zIndex = String(z++);
  helpDiv     .style.zIndex = String(z++);
  closetDiv   .style.zIndex = String(z++);
  modalMaskDiv.style.zIndex = String(z++);
  editUserDiv .style.zIndex = String(z++);
}

export enum ScreenMode {
  DISCONNECTED,
  LOGIN,
  WAITING_FOR_SERVER_CONNECT,
  WAITING_FOR_CREATE_ROOM,
  WAITING_FOR_ROOM_CODE_CONFIRMATION,
  PLAY
}
let screenMode = ScreenMode.LOGIN;
export function getScreenMode() {
  return screenMode;
}
const createRoomButton = document.getElementById("createRoomButton") as HTMLInputElement;
createRoomButton.addEventListener("click", function () {
  connectToServer(null);
});
const roomCodeTextbox = document.getElementById("roomCodeTextbox") as HTMLInputElement;
roomCodeTextbox.addEventListener("keydown", function (event) {
  event.stopPropagation();
  if (event.keyCode === 13) {
    setTimeout(submitRoomCode, 0);
  } else {
    setTimeout(function () {
      let value = roomCodeTextbox.value;
      let canonicalValue = value.toUpperCase();
      if (value === canonicalValue) return;
      let selectionStart = roomCodeTextbox.selectionStart;
      let selectionEnd = roomCodeTextbox.selectionEnd;
      roomCodeTextbox.value = canonicalValue;
      roomCodeTextbox.selectionStart = selectionStart;
      roomCodeTextbox.selectionEnd = selectionEnd;
    }, 0);
  }
});
const joinRoomButton = document.getElementById("joinRoomButton") as HTMLInputElement;
joinRoomButton.addEventListener("click", submitRoomCode);
function submitRoomCode() {
  connectToServer(roomCodeTextbox.value);
}
const loadingMessageDiv = document.getElementById("loadingMessageDiv") as HTMLDivElement;
export function setScreenMode(newMode: ScreenMode) {
  screenMode = newMode;
  let loadingMessage = null;
  let activeDivId = (function () {
    switch (screenMode) {
      case ScreenMode.PLAY: return "roomDiv";
      case ScreenMode.LOGIN: return "loginDiv";
      case ScreenMode.DISCONNECTED:
        loadingMessage = "Disconnected...";
        return "loadingDiv";
      case ScreenMode.WAITING_FOR_SERVER_CONNECT:
        loadingMessage = "Trying to reach the server...";
        return "loadingDiv";
      case ScreenMode.WAITING_FOR_CREATE_ROOM:
        loadingMessage = "Waiting for a new room...";
        return "loadingDiv";
      case ScreenMode.WAITING_FOR_ROOM_CODE_CONFIRMATION:
        loadingMessage = "Checking room code...";
        return "loadingDiv";
      default: programmerError();
    }
  })();
  ["roomDiv", "loginDiv", "loadingDiv"].forEach(function (divId) {
    setDivVisible(document.getElementById(divId) as HTMLDivElement, divId === activeDivId);
  });
  if (activeDivId === "loginDiv") roomCodeTextbox.focus();
  loadingMessageDiv.textContent = loadingMessage != null ? loadingMessage : "Please wait...";
}
function setDivVisible(div: HTMLDivElement, visible: boolean) {
  div.style.display = visible ? "block" : "none";
}
