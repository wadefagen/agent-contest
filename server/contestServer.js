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
  agent.process.kill();

  // Remove the agent
  // TODO: Not just by starving it
  agent.food = -999999;
};




var startDay = function() {
  console.log("[contestServer]: == STARTING DAY ==");
  contest.startDay();
  console.log("[contestServer]: capital: " + JSON.stringify(contest.capitalData()));
  runNextAgent();
};

var runNextAgent = function() {
  var agent = contest.next();

  if (agent === undefined) {
    finishedDay();
  } else {

    console.log("[contestServer]: [IPC]: Launching " + agent.file + " (id: " + agent.id + ", food: " + agent.food + ")");
    agent.process = fork("server/contestServerAgentRunner.js", [agent.file]);

    agent.timer = setTimeout(agentProcessTimeout, 200 + (50 * contest.count()), agent);
    agent.process.on("message", agentProcessOnMessage_f(agent));
    agent.process.on("exit", agentProcessOnExit_f(agent));

    if (typeof agent.name == "undefined") {
      agent.process.send({message: "requestName"});
    }

    contest.each(function (partner) {
      // Skip self
      if (partner == agent) { return; }

      agent.results[partner.id] = '-';
      agent.process.send({
        message: "hunt",

        selfId: agent.id,
        self: contest.hunterData(agent, partner),

        partnerId: partner.id,
        partner: contest.hunterData(partner, agent),

        capital: contest.capitalData()
      });
    });

    agent.process.send({message: "exit"});
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






    var resultsTemplate = hbs.compile(fs.readFileSync('./server/results.hbs', 'utf8'));

    var days = [];
    for (var i = 0; i < contest.capitalData().day; i++) {
      days.push("" + (i + 1));
    }

    var output = resultsTemplate({ days: days, constestHistoryArray: constestHistoryArray });



    //fs.writeFileSync("./server-log/latest.html", output);
    //fs.writeFileSync("./server-log/" + Date.now() + ".html", output);
    fs.writeFileSync("/var/www/html/jsContest/results/latest.html", output);
    fs.writeFileSync("/var/www/html/jsContest/results/" + Date.now() + ".html", output);

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
