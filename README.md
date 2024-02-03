# Board Gamer 2d

2d multiplayer html5 board game simulator.

## Run it for development

Install `node` and `npm`. (For NixOS, see `./*.nixos.sh` for convenience.)

```
./build-and-run.sh
```

#### Run it in public mode

Note: The security of this project has not been thoroughly audited. Use at your own risk.

To allow external device access:

```diff
diff --git a/lib/server.ts b/lib/server.ts
index eedb131..b4f8699 100644
--- a/lib/server.ts
+++ b/lib/server.ts
@@ -5,7 +5,7 @@ import {WebSocket, WebSocketServer} from "ws";
 import database from "./database";
 import defaultRoomState from "./defaultRoom";
 
-const bindIpAddress = "127.0.0.1";
+const bindIpAddress = "0.0.0.0";
 
 function main() {
   var app = express();
```

Also note that if you're not just on localhost, you'll need to put an HTTPS-enabled proxy in front of this app, or figure out how to enable TLS with a patch here. If you are confused why this is necessary, so am I. It seems to be a failed deseign in SubtleCrypto, which provides native sha1 hashing: https://github.com/w3c/webcrypto/issues/28#issuecomment-1173977574 . But don't worry:

> The web in general is moving to being HTTPS-only. It's even easier and cheaper today to request a TLS certificate for any website than it was in 2016, thanks to initiatives like Let's Encrypt. For local applications, something like Electron can be used. For IoT devices, rather than hosting the entire web app on the device, I would recommend hosting a web app (or creating an Electron app), and then communicating from that web app with the IoT devices.

So if you don't like it, it's your own fault, says Big Tech.

## Status

Working:

 * Create and join rooms. Empty rooms are deleted after an hour.
 * Some objects are supported out of the box: Deck of 52 playing cards, d6 dice, checker board and checkers.
 * Decent controls to manipulate objects: Examine, group together, spread apart, move around, flip over.
 * RNG Controls: Shuffle a stack, roll objects to show a random side.
 * Multiplayer experience is synced when you let go of the mouse, requiring fairly low network traffic.
 * Objects can be "locked" to serve as a background, and they can define a snap-to-grid area.
 * Individual players can have a special area where only they can see all sides of the objects in it;
   in other words, their hand of cards is hidden from opponents.
 * Undo/redo history is maintained server-side per room, and is accessible by any client even after joining late or refreshing the page.

Planned:

 * Multiplayer gameplay:
   * Spawn textboxes on the table that everyone can see and edit.
   * Number counters for keeping track of score. Basic calculator functions, like add and subtract.
   * A "turn order" widget that accepts a hotkey for "my turn is done", and plays a sound for the next player.
   * A stopwatch widget and a timer widget.
   * An interactive undo/redo tree explorer.
   * Sound effects and animations for shuffling and some other actions.
 * Workshop for creating your own games:
   * Any player can switch in and out of workshop mode while playing a game.
   * Upload images, crop/rotate images.
   * Add arbitrary text to objects.
   * Define snap grids on objects.
   * A "closet" with standard objects ready to import (french deck, d6 dice, etc.).
   * A "box" with objects relevant to your game that are not currently on the table.
   * Define a fixed limit for number of players, and assign each player a unique color. Objects can be associated with each player.
   * Define no limit on the number of players. Players would be listed in a scrolling box, and each player gets a mini-table defined by a template.

## Philosophy

Board Gamer 2d does not know the rules of any particular game.
It provides objects, controls, and a multiplayer environment for players to play games that only they know the rules for.
The primary intended use for this project is to allow board game creators to prototype game ideas with their friends.

Board Gamer 2d does not take responsibility for enforcing any rules of the game whatsoever.
Board Gamer 2d permits malicious players to cheat flagrantly if they choose to,
such as looking at other players' hands, rearranging the deck secretly, kicking players out of the game, etc.
It is expected that players have cooperative attitudes and want to play fairly.

The Board Gamer 2d engine will try to support almost every style of tabletop game,
from Candyland to Settlers of Catan to Dutch Blitz, but will not include any copyrighted material.
The intention is that users will upload their own ideas for games, and try them out with this project,
eventually perhaps realizing their ideas in the real world through the use of a print shop or whatever.

Some styles of games are outside the scope of this project, such as Mousetrap or Hungry Hungry Hippos, which rely on 3d physics.

Board Gamer 2d is not trying to compete with board game companies by providing a free alternative to buying the real game.
Rather, this enables board game creators to prototype ideas before spending money to see their ideas realized with physical objects.
