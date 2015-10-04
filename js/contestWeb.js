"use strict";

var contest = window.contest;
var agents = undefined;

var templateFoodList, templateHuntList, templateFoodListBonus;
var contestRunning = false;
var contestError = false;

var contestPlayOne = function() {
  if (agents === undefined) { init(); }
  if (contestError) { return; }
  runDay(true);
};

var contestPlay = function() {
  if (agents === undefined) { init(); }
  if (contestError) { return; }
  document.getElementById("contestPlayOne").disabled = true;
  document.getElementById("contestPlay").disabled = true;
  document.getElementById("contestPause").disabled = false;

  contestRunning = true;
  runDay(true);
};

var contestPause = function() {
  document.getElementById("contestPlayOne").disabled = false;
  document.getElementById("contestPlay").disabled = false;
  document.getElementById("contestPause").disabled = true;

  contestRunning = false;
};

var raiseError = function (s) {
  contestError = true;
  contestPause();
  document.getElementById("jserror").style.display = "block";
  document.getElementById("jserror-text").innerHTML = s;
};


var init = function() {
  agents = window.players;

  if (agents.length < 2) {
    raiseError("You must have at least two players enabled to run the Games.");
    return;
  }

  contest.init(agents.length, function (agent, i) {
    agent.obj = agents[i];
    agent.name = agents[i].name.replace(/&/g, '&amp;')
                               .replace(/"/g, '&quot;')
                               .replace(/'/g, '&#39;')
                               .replace(/</g, '&lt;')
                               .replace(/>/g, '&gt;');
  });


  templateFoodList = Handlebars.compile(document.getElementById("template-foodList").innerHTML);
  templateHuntList = Handlebars.compile(document.getElementById("template-huntList").innerHTML);
  templateFoodListBonus = Handlebars.compile(document.getElementById("template-foodListBonus").innerHTML);
};

var runDay = function(force) {
  if (contestError) { return; }
  if (!force && !contestRunning) { return; }
  if (contest.getWinner() !== undefined) { return; }

  // Process the start of the day...
  contest.startDay();
  var el = document.getElementById("contestDisplay");

  // Write output to the user...
  var s = '<div class="day">CS 105 Hunger Games: Day ' + contest.capitalData().day + '</div>';

  s += '<div class="row">';

  s += '<div class="col-md-3">';
  s += templateFoodList({agents: contest.getAgents() });
  s += '</div>';

  // Run each agent vs. every other agent...
  var agent;
  while ((agent = contest.next()) !== undefined) {
    contest.each(function (partner) {
      // Skip self
      if (agent.id == partner.id) { return; }

      // Run makeDecision
      var result = agent.obj.makeDecision(
        contest.hunterData(agent, partner),
        contest.hunterData(partner, agent),
        contest.capitalData()
      );

      // Check the the return value is valid
      if (result == "h" || result == "s") {
        agent.results[partner.id] = result;
      } else {
        var error = "The player <b>" + agent.obj.name + "</b> was asked to made a decision about a hunt. " +
                    "The player returned &quot;" + result + "&quot; instead of &quot;h&quot; or &quot;s&quot;.";
        raiseError(error);
        throw new Error(error);
      }
    });
  }

  // Write out the results...
  var results = [];

  contest.each(function (agent) {
    contest.each(function (agent2) {
      if (agent.id >= agent2.id) { return; }

      var foodEarned = 0;
      var result = {
        name1: agent.name,
        name2: agent2.name,
        food1: 0,
        food2: 0
      };

      if (agent.results[agent2.id] == 'h') {
        result.result1 = '<span class="hunt">Hunt</span>';
        result.food1 -= 6;
        foodEarned += 6;
      } else {
        result.result1 = '<span class="slack">Slack</span>';
        result.food1 -= 2;
      }

      if (agent2.results[agent.id] == 'h') {
        result.result2 = '<span class="hunt">Hunt</span>';
        result.food2 -= 6;
        foodEarned += 6;
      } else {
        result.result2 = '<span class="slack">Slack</span>';
        result.food2 -= 2;
      }

      result.food1 += foodEarned / 2;
      result.food2 += foodEarned / 2;

      if (result.food1 >= 0) { result.food1 = "+" + result.food1; }
      if (result.food2 >= 0) { result.food2 = "+" + result.food2; }

      results.push(result);
    });
  });

  s += '<div class="col-md-6">';
  s += templateHuntList({results: results});
  s += '</div>';

  contest.finishedDay();

  s += '<div class="col-md-3">';
  s += templateFoodListBonus({agents: contest.getAgents()});
  s += '</div>';

  s += "</div>";

  //el.innerHTML = s + el.innerHTML;
  el.innerHTML = s;

  var winner = contest.getWinner();
  //if (contest.capitalData().day < 20) { setTimeout(runDay, 100); }
  if (winner == undefined) { setTimeout(runDay, 100); }
};
