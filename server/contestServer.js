var fork = require("child_process").fork;
var contest = require("../js/contestCommon");
var fs = require('fs');
var hbs = require("./handlebars.js");
var numeral = require("./numeral.js");

var agentFileNamesNoPath = fs.readdirSync("./players/");

var agentFileNames = [];
agentFileNamesNoPath.forEach(function (fileName) {
  agentFileNames.push("../players/" + fileName);
});


var agentProcessOnMessage = function(d) {
  switch (d.message) {
    case "result":
      contest.getAgent(d.index).results[d.partnerId] = d.result;
      break;

    case "error":
      contest.getAgent(d.index).food = -99998;
      break;

    case "name":
      contest.getAgent(d.index).name = -d.name;
      break;

    case "unloaded":
      runnerProcess = null;
      clearTimeout(timeoutTimer);
      runNextAgent();
      break;
  }
};

var agentProcessOnExit = function (d) {
  if (currentAgent != null) {
    currentAgent.food = -99999;
    currentAgent = null;

    runnerProcess = null;
    clearTimeout(timeoutTimer);
    runNextAgent();
  }
};



var agentProcessOnMessage_f = function (agent) {
  return function (d) {
    if (d.message == "result") {
      agent.results[d.partnerId] = d.result;
    } else if (d.message == "error") {
      agent.food = -998;
    } else if (d.message == "name") {
      agent.name = d.name;
    }
  };
};

var agentProcessOnExit_f = function (agent) {
  return function (code, signal) {
    console.log("[contestServer]: [IPC]: Player process exit (id=" + agent.id + ", code=" + code + ")");
    clearTimeout(agent.timer);
    runNextAgent();
  };
};


var agentProcessTimeout = function (agent) {
  // Kill the agent process
  currentAgent.food = -999999;
  runnerProcess.kill();
};




var startDay = function() {
  console.log("[contestServer]: == STARTING DAY ==");
  contest.startDay();
  console.log("[contestServer]: capital: " + JSON.stringify(contest.capitalData()));
  runNextAgent();
};



var runnerProcess = null;
var timeoutTimer = null;
var currentAgent = null;

var runNextAgent = function() {
  var agent = contest.next();

  if (agent === undefined) {
    finishedDay();
  } else {
    currentAgent = agent;

    if (agentRunnerProcess == null) {
      runnerProcess = fork("server/contestServerAgentRunner.js");
      runnerProcess.on("message", agentProcessOnMessage);
      runnerProcess.on("exit", agentProcessOnExit);
    } else {

      // Reset the timeout for the new agent
      if (timeoutTimer != null) {
        clearTimeout(timeoutTimer);
      }
      timeoutTimer = setTimeout(agentProcessTimeout, 200 + (50 * contest.count()), agent);

      // Load the agent
      runnerProcess.send({message: "load", file: agent.file});

      // Ensure we have the name saved
      if (typeof agent.name == "undefined") {
        runnerProcess.send({message: "requestName", index: contest.getAgents().indexOf(agent)});
      }

      // Request hunts
      contest.each(function (partner, index) {
        if (partner == agent) { return; }

        agent.results[partner.id] = '-';
        runnerProcess.send({
          message: "hunt",
          index: index,

          selfId: agent.id,
          self: contest.hunterData(agent, partner),

          partnerId: partner.id,
          partner: contest.hunterData(partner, agent),

          capital: contest.capitalData()
        });
      };

      // Unload agent
      runnerProcess.send({message: "unload"});
    }
  }
};


var finishedDay = function() {
  console.log("[contestServer]: == END DAY == ");

  contest.finishedDay();

  // Store the current food in the contest history
  contest.each(function (agent) {
    contestHistory[agent.id].food.push(agent.food);
  });

  if (contest.getWinner() !== undefined || contest.capitalData().day == 2000) {
    console.log("[contestServer]: == CONTEST END == ");

    var constestHistoryArray = [];
    for (h in contestHistory) {
      constestHistoryArray.push(contestHistory[h]);
    }

    constestHistoryArray.sort(function (a, b) {
      if (a.agent.lastDay < b.agent.lastDay) {
        // b lasted longer, b is better
        return 1;
      } else if (b.agent.lastDay < a.agent.lastDay) {
        // a lasted longer, a is better
        return -1;
      } else if (a.agent.food < b.agent.food) {
        // b has more food, b is better
        return 1;
      } else if (b.agent.food < a.agent.food) {
        // a has more food, a is better
        return -1;
      } else {
        return 0;
      }
    });

    // Write output as JSON
    var output = JSON.stringify({
      players: contestHistory,
      capital: contest.capitalData()
    });

    fs.writeFileSync("/var/www/html/jsContest/results/latest.json", output);
    fs.writeFileSync("/var/www/html/jsContest/results/" + Date.now() + ".json", output);

    runnerProcess.send({message: "exit"});
    process.exit();

  } else {
    // Start the next day...
    startDay();
  }
};

var contestHistory = {};

contest.init(agentFileNames.length, function (agent, i) {
  agent.file = agentFileNames[i];
});

contest.each(function (agent) {
  contestHistory[agent.id] = {
    agent: agent,
    food: []
  };
});

startDay();

setTimeout(function () { }, Number.MAX_VALUE);
