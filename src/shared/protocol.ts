export interface UserJoinedArgs {
  id: UserId,
  userName: string,
  role: RoleId,
}
export interface UserLeftArgs {
  id: UserId,
}
export interface ChangeMyNameArgs {
  id: UserId,
  userName: string,
}
export interface ChangeMyRoleArgs {
  id: UserId,
  role: RoleId,
}

export interface JoinRoomArgs {
  roomCode: string,
  userId:   UserId,
  userName: string,
  role:     RoleId,
  database: DbEntry[],
  game:     RoomState,
  history:  MakeAMoveArgs[],
  users:    UserInfo[],
}

export type MakeAMoveArgs = any; // TODO
export interface UserInfo {
  id:       UserId,
  userName: string,
  role:     RoleId,
}

export interface DbEntry {
  id: DbEntryId,
  // regular game object
  width?: number,
  height?: number,
  faces?: ImagePath[],
  // board
  snapZones?: SnapZone[]
  // closet properties
  closetName?: string,
  thumbnail?: ImagePath,
  thumbnailWidth?: number,
  thumbnailHeight?: number,
  items?: DbEntryId[],
  // screen
  hideFaces?: number[],
  visionWhitelist?: RoleId[],
  labelPlayerName?: RoleId,
  backgroundColor?: ColorWithParameterizedAlpha,
}
export interface SnapZone {
  x?: number,
  y?: number,
  width?: number,
  height?: number,
  cellWidth?: number,
  cellHeight?: number,
}

export interface RoomState {
  roles: RoleDisplayNameBinding[],
  objects: ObjectState[],
}
export interface RoleDisplayNameBinding {
  id: RoleId,
  name: string,
}
export interface ObjectState {
  id: ObjectId,
  prototype: DbEntryId,
  width: number,
  height: number,
  locked: boolean,
  temporary: boolean,

  x: number,
  y: number,
  z: number,
  faceIndex: number,

  faces: ImagePath[],
  snapZones: SnapZone[],
  hideFaces: number[],
  visionWhitelist: RoleId[],
  labelPlayerName: RoleId | "",
  backgroundColor: ColorWithParameterizedAlpha | "",
}

export type DbEntryId = string;
export type ImagePath = string; // "path.png" or "path.png#x,y,w,h" where [xywh] are integers in base 10.
export type UserId = string;
export type RoleId = string;
export type ColorWithParameterizedAlpha = string; // e.g. "rgba(255,0,0,$alpha)"
export type ObjectId = string;
