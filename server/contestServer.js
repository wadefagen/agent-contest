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
      console.log(d.index);
      contest.getAgent(d.index).name = d.name;
      break;

    case "unloaded":
      currentAgent = null;
      clearTimeout(timeoutTimer);
      runNextAgent();
      break;
  }
};

var agentProcessOnExit = function (code, signal) {
  console.log("[contestServer]: [IPC]: Player process exit (code=" + code + ")");

  if (currentAgent != null) {
    currentAgent.food = -99999;
    currentAgent = null;

    runnerProcess = null;
    clearTimeout(timeoutTimer);
    runNextAgent();
  }
};



var agentProcessTimeout = function (agent) {
  console.log("[contestServer]: [Timeout]: Timeout!");

  // Kill the agent process
  currentAgent.food = -999999;
  runnerProcess.kill();
};




var startDay = function() {
  console.log("[contestServer]: == STARTING DAY ==");
  contest.startDay();
  console.log("[contestServer]: capital: Day #" + contest.capitalData().day);
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

    if (runnerProcess == null) {
      runnerProcess = fork("server/contestServerAgentRunner.js");
      runnerProcess.on("message", agentProcessOnMessage);
      runnerProcess.on("exit", agentProcessOnExit);
    }

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
    var index = contest.getAgents().indexOf(agent);
    contest.each(function (partner) {
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
    });

    // Unload agent
    runnerProcess.send({message: "unload"});

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

    constestHistoryArray.forEach(function (d) {
      console.log(d.agent.file);
      var fileName = d.agent.file;

      // Identify me
      if (fileName.indexOf("waf.js") != -1) { d.agent.isWade = true; }

      // Identify course staff
      ["mhellwig", "ysun69", "hcai6", "srmurth2", "aaahuja2", "abhardw3", "hoskere2", "ckulkarn", "mahdian2", "zhang349", "chizhou3", "sihanli2", "rsehgal2"].forEach(function (id) {
        if (fileName.indexOf(id + ".js") != -1) {
          d.agent.isCourseStaff = true;
        }
      });

      // Identify default players
      ["hueTheHunter", "samTheSlacker", "randomRaj", "randomRiko"].forEach(function (id) {
        if (fileName.indexOf(id + ".js") != -1) {
          d.agent.isDefaultPlayer = true;
        }
      });

      d.agent.file = undefined;
    });


    // Prep HBS template
    var resultsTemplate = hbs.compile(fs.readFileSync('./server/results.hbs', 'utf8'));

    var days = [];
    for (var i = 0; i < contest.capitalData().day; i++) {
      var blessing = false;
      if (contest.capitalData().huntParticipationHistory[i] > contest.capitalData().blessingThresholdHistory[i]) {
        blessing = true;
      }

      days.push({
        day: (i + 1),
        blessingThreshold: numeral(contest.capitalData().blessingThresholdHistory[i]).format("0.00%"),
        huntParticipation: numeral(contest.capitalData().huntParticipationHistory[i]).format("0.00%"),
        blessing: blessing
      });
    }

    var output = resultsTemplate({ days: days, constestHistoryArray: constestHistoryArray });




    fs.writeFileSync("./server-output/latest.html", output);
    fs.writeFileSync("./server-output/" + Date.now() + ".html", output);

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
