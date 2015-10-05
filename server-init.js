var fork       = require("child_process").fork;
var fs         = require('fs-extra');
var config     = require("./config/config");

// Re-launch self at end
function destroyAndRelaunch() {
  fork("./server-init.js", {detached: true});
  process.exit();
}

// (1): Clean up the previous run by emptying `players` dir:
fs.emptyDirSync("./players/");

// (2): Copy the base agents
["hueTheHunter.js", "samTheSlacker.js", "randomRiko.js", "randomRaj.js"].forEach(function (file) {
  fs.copySync("./players-base/" + file, "./players/" + file);
});


// Run local config and launch contest server
config.setupLocal(function (err) {
  if (err) { throw err; }

  var process = fork("./server/contestServer.js");
  process.on("exit", function (code, signal) {
    console.log("SERVER RUN COMPLETE -- WAITING TO RELAUNCH SELF")
    // Pause for 1min then relaunch self
    //setTimeout(destroyAndRelaunch, 60 * 1000);
  });
});
