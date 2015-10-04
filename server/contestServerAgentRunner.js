var agent = null;
if (process.argv.length == 3) {
  agent = require(process.argv[2]);
}

process.on("message", function (d) {
  switch (d.message) {
    case "load":
      agent = require(d.file);
      break;

    case "unload":
      agent = null;
      process.send({message: "unloaded"});
      break;

    case "requestName":
      process.send({message: "name", id: d.id, name: agent.name});
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


/*
var agent = require(process.argv[2]);

process.on("message", function (d) {
  if (d.message == "hunt") {
    var result = agent.makeDecision( d.self, d.partner, d.capital );

    if (result == 'h' || result == 's') {
      process.send({
        message: "result",
        partnerId: d.partnerId,
        result: result
      });
    } else {
      process.send({
        message: "error",
        error: "The result of makeDecision was not 'h' or 's'."
      });

      process.exit();
    }
  } else if (d.message == "requestName") {
    process.send({message: "name", name: agent.name});
  } else if (d.message == "exit") {
    process.exit();
  }

});

setTimeout(function () { }, 3600 * 1000);
*/
