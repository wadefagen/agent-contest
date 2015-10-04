"use strict";

var player = {
  // Enter the name of this player in CS 105's Hunger Games
  // (When submitted, this `name` WILL appear on the contest page.  You can
  // use whatever name you would like, it should probably not be your real name,
  // but it should be clean and not disrespectful.)
  name: "Sam the Slacker",

  // Program the makeDecision function to play in the contest!
  makeDecision: function(me, partner, capital) {
    return "s";
  }
};




//
// The following hooks your agent into the pool of existing agents and is
// required to run as part of the contest.  None of these lines have errors
// and you should not edit them.
//
// If the JavaScript console reports an error on the very last line of the file,
// the root cause of this is likely a bracket or brace that you opened but
// did not close somewhere inside of your player.
//
if (typeof module != "undefined") { module.exports = player };
if (typeof window != "undefined") {
  if (typeof window.players == "undefined") { window.players = []; }
  window.players.push(player);
}
