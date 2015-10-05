var agentCache = {};

var loadAgent = function(fileName) {
  if (agentCache[fileName] !== undefined) {
    return agentCache[fileName];
  } else {
    var agent = require(fileName);
    agentCache[fileName] = agent;
    return agent;
  }
}


var agent = null;
if (process.argv.length == 3) {
  agent = loadAgent(process.argv[2]);
}

process.on("message", function (d) {
  switch (d.message) {
    case "load":
      agent = loadAgent(d.file);
      break;

    case "unload":
      agent = null;
      process.send({message: "unloaded"});
      break;

    case "requestName":
      process.send({message: "name", index: d.index, name: agent.name});
      break;

    case "exit":
      process.exit();
      break;

    case "hunt":
      var result = agent.makeDecision( d.self, d.partner, d.capital );

      if (result == 'h' || result == 's') {
        process.send({
          message: "result",
          index: d.index,
          partnerId: d.partnerId,
          result: result
        });
      } else {
        process.send({
          message: "error",
          index: d.index,
          error: "The result of makeDecision was not 'h' or 's'."
        });
      }

      break;
  }
});

setTimeout(function () { }, Number.MAX_VALUE);
