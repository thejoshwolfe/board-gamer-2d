import { blackScreen, checkersBoard, checkersPieceBlack, checkersPieceRed, d6, redScreen } from "./database.js";

export default {
  roles: [
    { id: "red",   name: "Red",   },
    { id: "black", name: "Black", },
  ],
  objects: [
    { id: "aca0bc25154302c0", prototype: checkersBoard,      x: 200, y: 200, locked: true},
    { id: "22125166dd1e4ebe", prototype: checkersPieceRed,   x: 250, y: 200},
    { id: "39dedce2adc0a55b", prototype: checkersPieceRed,   x: 350, y: 200},
    { id: "6e2c8592007a371b", prototype: checkersPieceRed,   x: 450, y: 200},
    { id: "5e2256462ed3bcd2", prototype: checkersPieceRed,   x: 550, y: 200},
    { id: "4b6ff13bb0ef5090", prototype: checkersPieceRed,   x: 200, y: 250},
    { id: "36d034bb041dbd66", prototype: checkersPieceRed,   x: 300, y: 250},
    { id: "44d36cdf18c5d609", prototype: checkersPieceRed,   x: 400, y: 250},
    { id: "aea56feb57f6fffc", prototype: checkersPieceRed,   x: 500, y: 250},
    { id: "1880df97b4b223ff", prototype: checkersPieceRed,   x: 250, y: 300},
    { id: "04de4ecc4a0f8c43", prototype: checkersPieceRed,   x: 350, y: 300},
    { id: "3bbd5f952828f811", prototype: checkersPieceRed,   x: 450, y: 300},
    { id: "3ce74c244f99a38f", prototype: checkersPieceRed,   x: 550, y: 300},
    { id: "d43385278e8d0048", prototype: checkersPieceBlack, x: 200, y: 550},
    { id: "e1e897f6ad0c4a59", prototype: checkersPieceBlack, x: 300, y: 550},
    { id: "02cf0e2e38c7cfe8", prototype: checkersPieceBlack, x: 400, y: 550},
    { id: "dd8607dae64c0b12", prototype: checkersPieceBlack, x: 500, y: 550},
    { id: "dc6482597e84d447", prototype: checkersPieceBlack, x: 250, y: 500},
    { id: "8073834759a9daa1", prototype: checkersPieceBlack, x: 350, y: 500},
    { id: "fb6b39fad1110d68", prototype: checkersPieceBlack, x: 450, y: 500},
    { id: "18f26ecab73f7f85", prototype: checkersPieceBlack, x: 550, y: 500},
    { id: "549d7f90e2ddea39", prototype: checkersPieceBlack, x: 200, y: 450},
    { id: "25da20c2bd006689", prototype: checkersPieceBlack, x: 300, y: 450},
    { id: "559d7b3e1942f835", prototype: checkersPieceBlack, x: 400, y: 450},
    { id: "fd48ac61a037c86a", prototype: checkersPieceBlack, x: 500, y: 450},

    { id: "f4e3c6e761375088", prototype: d6, x: 650, y: 400},
    { id: "ea2c77efab27fb5d", prototype: d6, x: 675, y: 400},

    { id: "1ea3a7c466d4620e", prototype: redScreen,   x: 100, y: 0,   locked: true},
    { id: "ccc8079115a21553", prototype: blackScreen, x: 100, y: 700, locked: true},
  ],
};
