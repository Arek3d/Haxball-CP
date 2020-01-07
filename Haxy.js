/*
This script is usable in https://www.haxball.com/headless
*/

const geo = { 'code': 'eu', 'lat': 52.5192, 'lon': 13.4061 };
const room = HBInit({ roomName: 'Łemblej', maxPlayers: 16, playerName: 'Pan Włodek', public: false, geo });
room.setDefaultStadium('Huge');
room.setScoreLimit(5);
room.setTimeLimit(8);

// If there are no admins left in the room give admin to one of the remaining players.
function updateAdmins() {
  // Get all players except the host (id = 0 is always the host)
  const players = room.getPlayerList().filter(player => player.id !== 0);
  if (players.length === 0) return; // No players left, do nothing.
  if (players.some(player => player.admin)) return; // There's an admin left so do nothing.

  room.setPlayerAdmin(players[0].id, true); // Give admin to the first non admin player in the list
}

function initPlayerStats(player) {
  if (stats.get(player.name)) return;
  stats.set(player.name, [0, 0, 0, 0, 0, 0, 0]); // goals, assists, wins, loses, og, cs, offsides
}

/*
for commands
*/

function swapFun(player) {
  if (player.admin === true && room.getScores() === null) {
    const players = room.getPlayerList();

    players.forEach(player => {
      if (player.team === 1) {
        room.setPlayerTeam(player.id, 2);
      } else if (player.team === 2) {
        room.setPlayerTeam(player.id, 1);
      }
    });
  }
}

function helpFun() { // !help
  room.sendChat('Available commands: "p", "!p" , "!stats Nickname", "!ranking", "!poss", "!resetstats", "!adminhelp", "!gkhelp", "!rankhelp"');
}

function adminHelpFun() {
  room.sendChat('Available commands: "!mute Player", "!unmute Player", ' +
    '"!clearbans", "!rr", "!swap" (to switch reds and blues). You need to be admin.');
}


function gkHelpFun() { // !gkhelp
  room.sendChat('The most backward player at the kick off will be set as gk ! (write "!gk" if the bot was wrong).');
}
function rankHelpFun() { // !gkhelp
  room.sendChat('Get points by doing good things in this room ! Goal: 5 pts, assist: 3 pts, win: 3 pts, cs: 6 pts, lose: -7 pts, og: -4 pts.');
}


function statsFun(player, message) { // !stats Anddy
  if (stats.get(message.substr(7))) {
    sendStats(message.substr(7));
  } else {
    return false;
  }
}

function rankFun() { // !ranking
  const string = ranking();
  room.sendChat('Ranking: ' + string);
}

function resetStatsFun(player) { // !resetstats
  if (rankingCalc(player.name) > 0) {
    stats.set(player.name, [0, 0, 0, 0, 0, 0, 0]);
    room.sendChat('Your stats have been reseted ! ');
  } else {
    room.sendChat('You must have positive points to be able to reset it, sorry.');
  }
}

function clearFun(player) { // !clear
  if (player.admin === true) room.clearBans();
}

function resetFun(player) {
  if (player.admin === true) {
    room.stopGame();
    room.startGame();
  }
}

function gkFun(player) { // !gk
  if (room.getScores() !== null && room.getScores().time < 60) {
    if (player.team === 1) {
      gk[0] = player;
    } else if (player.team === 2) {
      gk[1] = player;
    }
  }
  return;
}


function closeFun(player) {
  if (player.name === 'js2ps') { // artificially generate an error in order to close the room
    stats.crash();
  }
}

/*
    For ranking
*/

function rankingCalc(player) {
  return stats.get(player)[0] * 4 + stats.get(player)[1] * 6 +
    stats.get(player)[2] * 5 + stats.get(player)[5] * 4 -
    stats.get(player)[3] * 0 - stats.get(player)[4] * 0 - stats.get(player)[6] * 4;
}

function ranking() {
  const overall = [];
  const players = Array.from(stats.keys());
  for (let i = 2; i < players.length; i++) {
    const score = rankingCalc(players[i]);
    // Goal: 4 pts, assist: 4 pts, win: 5 pts, cs: 4 pts, lose: 0 pts, og: 0 pts, offsides: -6pts
    overall.push({ name: players[i], value: score });
  }
  overall.sort((a, b) => b.value - a.value);
  let string = '';

  overall.forEach((item, i) => {
    if (item.value !== 0) {
      string += i + 1 + ') ' + overall[i].name + ': ' + overall[i].value + ' pts, ';
    }
  });

  return string;
}

function sendStats(name) {
  const ps = stats.get(name); // stands for playerstats

  room.sendChat(`
    ${name}:
    goals: ${ps[0]},
    assists: ${ps[1]},
    og: ${ps[4]},
    cs: ${ps[5]},
    wins: ${ps[2]},
    loses: ${ps[3]},
    offsides: ${ps[6]},
    points: ${rankingCalc(name)}
  `);
}


function whichTeam() { // gives the players in the red or blue team
  const players = room.getPlayerList();
  const redTeam = players.filter(player => player.team === 1);
  const blueTeam = players.filter(player => player.team === 2);
  return [redTeam, blueTeam];
}


function isGk() { // gives the mosts backward players before the first kickOff
  const players = room.getPlayerList();
  let min = players[0];
  min.position = { x: room.getBallPosition().x + 60 };
  let max = min;

  players.forEach(player => {
    if (player.position !== null) {
      if (min.position.x > player.position.x) min = player;
      if (max.position.x < player.position.x) max = player;
    }
  });

  return [min, max];
}

function updateWinLoseStats(winners, losers) {
  for (let i = 0; i < winners.length; i++) {
    stats.get(winners[i].name)[2] += 1;
  }
  for (let i = 0; i < losers.length; i++) {
    stats.get(losers[i].name)[3] += 1;
  }
}

let ballCarrying = new Map();
function initBallCarrying(redTeam, blueTeam) {
  const playing = redTeam.concat(blueTeam);

  playing.forEach(item => {
    ballCarrying.set(item.name, [0, item.team]); // secs, team, %
  });

  return ballCarrying;
}


function updateTeamPoss(value) {
  if (value[1] === 1) redPoss += value[0];
  if (value[1] === 2) bluePoss += value[0];
}

let bluePoss;
let redPoss;
function teamPossFun() {
  if (room.getScores() === null) return false;
  bluePoss = 0;
  redPoss = 0;
  ballCarrying.forEach(updateTeamPoss);
  redPoss = Math.round((redPoss / room.getScores().time) * 100);
  bluePoss = Math.round((bluePoss / room.getScores().time) * 100);

  room.sendChat('Ball possession:  red ' + redPoss + ' - ' + bluePoss + ' blue.');
}

function getStatsToStore() {
  const players = room.getPlayerList().filter(player => player.id !== 0);

  players.forEach(player => {
    const stats = stats.get(player.name); // goals, assists, wins, loses, og, cs
  });
}

/*
For the game
*/

// Gives the last player who touched the ball, works only if the ball has the same
// size than in classics maps.
const radiusBall = 10;
const triggerDistance = radiusBall + 15 + 0.1;
function getLastTouchTheBall(lastPlayerTouched) {
  const ballPosition = room.getBallPosition();
  const players = room.getPlayerList();

  players.forEach(player => {
    if (player.position !== null) {
      const distanceToBall = pointDistance(player.position, ballPosition);
      if (distanceToBall < triggerDistance) {
        lastPlayerTouched = player;
        return lastPlayerTouched;
      }
    }
  });

  return lastPlayerTouched;
}


// Calculate the distance between 2 points
function pointDistance(p1, p2) {
  const d1 = p1.x - p2.x;
  const d2 = p1.y - p2.y;
  return Math.sqrt(d1 * d1 + d2 * d2);
}

function checkIfItIsOffside(playerWhoPass) {
  var players = room.getPlayerList();
  players = players.filter(x => (x.team === 1 || x.team === 2));
  if (players.length > 2) {
    if (playerWhoPass.team === 2) {
      players.sort((a, b) => a.position.x - b.position.x);
    } else {
      players.sort((a, b) => b.position.x - a.position.x);
    }
    if (players[0].id !== playerWhoPass.id) {
      if (players[0].team === playerWhoPass.team) {
        if (players[1].id !== playerWhoPass.id) {
          if (((players[0].position.x > 0) && (players[0].team === 1)) || ((players[0].position.x < 0) && (players[0].team === 2))) {
            var id = players.findIndex(x => x.id === playerWhoPass.id);
            var i = 1;
            while (i < id) {
              if (players[i].team !== playerWhoPass.team) {
                room.sendChat('' + players[0].name + ', you are sęp! -4pts');
                stats.get(players[0].name)[6] += 1;
                i = id;
              }
              i++;
            }
          }
        }
      }
    }
  }
}

function isOvertime() {
  const scores = room.getScores();
  if (scores !== null && scores.timeLimit !== 0 && scores.time > scores.timeLimit && scores.red === 0 && hasFinished === false) {
    stats.get(gk[0].name)[5] += 1;
    stats.get(gk[1].name)[5] += 1;
    hasFinished = true;
  }
}
// return: the name of the team who took a goal
const team_name = team => team === 1 ? 'blue' : 'red';

// return: whether it's an OG
const isOwnGoal = (team, player) => team !== player.team ? ' (og)' : '';

// return: a better display of the second when a goal is scored
const floor = s => s < 10 ? '0' + s : s;

// return: whether there's an assist
const playerTouchedTwice = playerList => playerList[0].team === playerList[1].team ? ' (' + playerList[1].name + ')' : '';

/*
Events
*/
const stats = new Map(); // map where will be set all player stats
const mutedPlayers = []; // Array where will be added muted players
const init = 'init'; // Smth to initialize smth
init.id = 0; // Faster than getting host's id with the method
init.name = 'init';
let scorers; // Map where will be set all scorers in the current game (undefined if reset or end)
let whoTouchedLast; // var representing the last player who touched the ball
let whoTouchedBall = [init, init]; // Array where will be set the 2 last players who touched the ball
let gk = [init, init];
let goalScored = false;

const commands = {
  // Command that doesnt need to know players attributes.
  '!help': helpFun,
  '!gkhelp': gkHelpFun,
  '!adminhelp': adminHelpFun,
  '!rankhelp': rankHelpFun,
  '!ranking': rankFun,
  '!poss': teamPossFun,

  // Command that need to know who is the player.
  '!resetstats': resetStatsFun,
  '!gk': gkFun,

  // Command that need to know if a player is admin.
  '!swap': swapFun,
  '!rr': resetFun,
  '!clear': clearFun,
  '!close': closeFun,

  // Command that need to know what's the message.
  '!stats': statsFun,
};

initPlayerStats(room.getPlayerList()[0]); // lazy lol, i'll fix it later
initPlayerStats(init);

room.onPlayerLeave = () => {
  updateAdmins();
};

room.onPlayerJoin = player => {
  updateAdmins(); // Gives admin to the first player who join the room if there's no one
  initPlayerStats(player); // Set new player's stat
  room.sendChat('Hi ' + player.name + ' ! Write !help, !adminhelp, !rankhelp or !gkhelp if needed.');
};

let redTeam;
let blueTeam;
room.onGameStart = () => {
  [redTeam, blueTeam] = whichTeam();
  ballCarrying = initBallCarrying(redTeam, blueTeam);
};

room.onPlayerTeamChange = player => {
  if (room.getScores() !== null) {
    if (player.team >= 1 <= 2) ballCarrying.set(player.name, [0, player.team]);
  }
};

room.onPlayerChat = (player, message) => {
  if (mutedPlayers.includes(player.name)) return false;
  const spacePos = message.search(' ');
  const command = message.substr(0, spacePos !== -1 ? spacePos : message.length);
  if (commands.hasOwnProperty(command) === true) return commands[command](player, message);
};

room.onPlayerBallKick = player => {
  whoTouchedLast = player;
  checkIfItIsOffside(player);
};

let kickOff = false;
let hasFinished = false;

room.onGameTick = () => {
  if (kickOff === false && room.getScores().time !== 0) {
    kickOff = true;
    gk = isGk();
    room.sendChat('Red GK: ' + gk[0].name + ', Blue GK: ' + gk[1].name);
  }
  if (goalScored === false) {
    whoTouchedLast = getLastTouchTheBall(whoTouchedLast);
  }
  if (whoTouchedLast !== undefined) {
    if (ballCarrying.get(whoTouchedLast.name)) {
      ballCarrying.get(whoTouchedLast.name)[0] += 1 / 60;
    }

    if (whoTouchedLast.id !== whoTouchedBall[0].id) {
      whoTouchedBall[1] = whoTouchedBall[0];
      whoTouchedBall[0] = whoTouchedLast; // last player who touched the ball
    }
  }

  isOvertime();
};

room.onTeamGoal = team => { // Write on chat who scored and when.
  goalScored = true;
  let time = room.getScores().time;
  const m = Math.trunc(time / 60); const s = Math.trunc(time % 60);
  time = m + ':' + floor(s); // MM:SS format
  const ownGoal = isOwnGoal(team, whoTouchedBall[0]);
  let assist = '';
  if (ownGoal === '') assist = playerTouchedTwice(whoTouchedBall);


  room.sendChat('A goal has been scored by ' + whoTouchedBall[0].name +
    assist + ownGoal + ' at ' +
    time + ' against team ' + team_name(team));

  if (ownGoal !== '') {
    stats.get(whoTouchedBall[0].name)[4] += 1;
  } else {
    stats.get(whoTouchedBall[0].name)[0] += 1;
  }

  if (whoTouchedBall[1] !== init && assist !== '') stats.get(whoTouchedBall[1].name)[1] += 1;


  if (scorers === undefined) scorers = new Map(); // Initializing dict of scorers
  scorers.set(scorers.size + 1 + ') ' + whoTouchedLast.name, [time, assist, ownGoal]);
  whoTouchedBall = [init, init];
  whoTouchedLast = undefined;
};

room.onPositionsReset = () => {
  goalScored = false;
};

room.onTeamVictory = scores => { // Sum up all scorers since the beginning of the match.
  if (scores.blue === 0 && gk[0].position !== null && hasFinished === false) stats.get(gk[0].name)[5] += 1;
  if (scores.red === 0 && gk[1].position !== null && hasFinished === false) stats.get(gk[1].name)[5] += 1;
  if (scores.red > scores.blue) {
    updateWinLoseStats(redTeam, blueTeam);
  } else { updateWinLoseStats(blueTeam, redTeam); }

  room.sendChat('Scored goals:');
  for (const [key, value] of scorers) { // key: name of the player, value: time of the goal
    room.sendChat(key + ' ' + value[1] + value[2] + ': ' + value[0]);
  }
  teamPossFun();
  rankFun();
};

room.onGameStop = () => {
  scorers = undefined;
  whoTouchedBall = [init, init];
  whoTouchedLast = undefined;
  gk = [init, init];
  kickOff = false;
  hasFinished = false;
};
