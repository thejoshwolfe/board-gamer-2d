# Board Gamer 2d

2d multiplayer html5 board game simulator.

## Demo

http://board-gamer-2d.wolfesoftware.com/

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

## vs Tabletop Simulator

*Note: This section is out of date. This compares against a very old version of Tabletop Simulator.*

Tabletop Simulator is available on Steam for a reasonable price.
Board Gamer 2d is free.

Tabletop Simulator is closed source.
Board Gamer 2d is open source.

Tabletop Simulator requires an account for multiplayer.
Board Gamer 2d allows anyone to join a room they know the code for; then they type in their name, which they can make up on the spot.

Tabletop Simulator must be trusted to run natively on your system after being installed.
Board Gamer 2d runs in the browser.

Tabletop Simulator has a community through Steam Workshop.
Board Gamer 2d has no clear plan for a community solution.

Tabletop Simulator is a 3d physics sandbox.
Board Gamer 2d is a 2d object manipulation sandbox.
Tabletop Simulator has a problem where game pieces can fall over and need to be picked up and put back upright.
Tabletop Simulator has a "flip table" feature, which is really just a joke.

Tabletop Simulator uses "unpredictable" physics for dice rolls and coin flips.
Board Gamer 2d uses a random number generator for dice rolls and coin flips.

Tabletop Simulator's system for creating a deck of cards has numerous problems.
The Board Gamer 2d engine allows arbitrary images or spritesheets with arbitrary coordinates and dimensions for all objects.
