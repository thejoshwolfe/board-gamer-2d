module.exports = {
  coordinateSystems: {
    "board": {
      x: 400,
      y: 400,
      unitWidth: 50,
      unitHeight: 50,
      minX: -4,
      minY: -4,
      maxX: 3,
      maxY: 3,
    },
  },
  objects: {
    "board": {
      front: "checkers/board.png",
      movable: false,
      coordinateSystem: "board",
      x: -4,
      y: -4,
      z: 0,
      width: 8,
      height: 8,
    },
    "gamePiece": {
      prototype: true,
      coordinateSystem: "board",
      width: 1,
      height: 1,
      snapX: 1,
      snapY: 1,
    },
    "redPiece": {
      prototype: true,
      prototypes: ["gamePiece"],
      front: "checkers/red_pawn.png",
      back: "checkers/red_king.png",
    },
    "773079001c053982": {
      prototypes: ["redPiece"],
      x: -4,
      y: -4,
      z: 1,
    },
    "85cc326176cf5ab3": {
      prototypes: ["redPiece"],
      x: -2,
      y: -4,
      z: 1,
    },
  },
};
