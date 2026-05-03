// Tournament Data Generator with Seeding
// Generates initial tournament structure with proper seeding based on Challonge-style brackets

// Sample player/team names
const maleNames = ['Aryan', 'Vijay', 'Rahul', 'Karan', 'Vikram', 'Akhil', 'Sanjay', 'Naveen', 
                   'Rohit', 'Aditya', 'Varun', 'Pranav', 'Rohan', 'Nikhil', 'Ravi', 'Ankit'];
const femaleNames = ['Aditi', 'Neha', 'Priya', 'Sneha', 'Anjali', 'Kavya', 'Pooja', 'Riya'];
const departments = ['CSA', 'EE', 'ME', 'Phy', 'Math', 'Bio', 'Civil', 'Chem', 'ECE', 'Aero', 'MSE', 'IPC'];

// Standard seeding positions for single elimination brackets
const seedingPatterns = {
  16: [1,16, 8,9, 5,12, 4,13, 6,11, 3,14, 7,10, 2,15],
  8: [1,8, 4,5, 2,7, 3,6],
  7: [1,'BYE', 4,5, 2,7, 3,6], // 7 teams = give bye to seed 1
  6: [1,'BYE', 4,5, 2,'BYE', 3,6] // 6 teams = give byes to seeds 1 and 2
};

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generatePlayers(count, isFemale = false) {
  const names = isFemale ? femaleNames : maleNames;
  const shuffledNames = shuffleArray(names);
  const shuffledDepts = shuffleArray(departments);
  
  return shuffledNames.slice(0, count).map((name, idx) => ({
    name,
    department: shuffledDepts[idx % shuffledDepts.length],
    seed: idx + 1
  }));
}

function generateTeams(count, format) {
  const isFemale = format === 'WD';
  const isMixed = format === 'XD';
  
  const shuffledDepts = shuffleArray(departments);
  const teams = [];
  
  for (let i = 0; i < count; i++) {
    let player1, player2;
    
    if (isMixed) {
      player1 = shuffleArray(maleNames)[i % maleNames.length];
      player2 = shuffleArray(femaleNames)[i % femaleNames.length];
    } else if (isFemale) {
      const shuffled = shuffleArray(femaleNames);
      player1 = shuffled[i * 2 % femaleNames.length];
      player2 = shuffled[(i * 2 + 1) % femaleNames.length];
    } else {
      const shuffled = shuffleArray(maleNames);
      player1 = shuffled[i * 2 % maleNames.length];
      player2 = shuffled[(i * 2 + 1) % maleNames.length];
    }
    
    teams.push({
      player1,
      player2,
      department: shuffledDepts[i % shuffledDepts.length],
      seed: i + 1
    });
  }
  
  return teams;
}

function createRound1Matches(format, participants, totalSlots) {
  const matches = [];
  const pattern = seedingPatterns[totalSlots];
  let matchNum = 1;
  
  const isDoubles = ['MD', 'WD', 'XD'].includes(format);
  
  // Create a map of existing seeds
  const participantMap = {};
  participants.forEach(p => {
    participantMap[p.seed] = p;
  });
  
  for (let i = 0; i < pattern.length; i += 2) {
    const seed1 = pattern[i];
    const seed2 = pattern[i + 1];
    
    let player1, player2;
    
    // Check if seed1 is BYE or doesn't exist
    if (seed1 === 'BYE' || !participantMap[seed1]) {
      player1 = 'Bye';
      const p2 = participantMap[seed2];
      if (p2) {
        player2 = isDoubles 
          ? `${p2.player1}/${p2.player2} (${p2.department})`
          : `${p2.name} (${p2.department})`;
      } else {
        player2 = 'Bye';
      }
    } else if (seed2 === 'BYE' || !participantMap[seed2]) {
      const p1 = participantMap[seed1];
      if (p1) {
        player1 = isDoubles 
          ? `${p1.player1}/${p1.player2} (${p1.department})`
          : `${p1.name} (${p1.department})`;
      } else {
        player1 = 'Bye';
      }
      player2 = 'Bye';
    } else {
      const p1 = participantMap[seed1];
      const p2 = participantMap[seed2];
      
      player1 = isDoubles 
        ? `${p1.player1}/${p1.player2} (${p1.department})`
        : `${p1.name} (${p1.department})`;
      player2 = isDoubles 
        ? `${p2.player1}/${p2.player2} (${p2.department})`
        : `${p2.name} (${p2.department})`;
    }
    
    const match = {
      Match_ID: `${format}_${matchNum}`,
      Round: 'Round 1',
      Status: (player1 === 'Bye' || player2 === 'Bye') ? 'completed' : 'scheduled',
      Score_1: '',
      Winner: ''
    };
    
    if (isDoubles) {
      match.Players_1 = player1;
      match.Players_2 = player2;
    } else {
      match.Player_1 = player1;
      match.Player_2 = player2;
    }
    
    // Auto-complete bye matches
    if (player1 === 'Bye') {
      match.Winner = player2;
    } else if (player2 === 'Bye') {
      match.Winner = player1;
    }
    
    matches.push(match);
    matchNum++;
  }
  
  return { matches, matchNum };
}

function createSubsequentRounds(format, round1Count, startMatchNum) {
  const matches = [];
  let matchNum = startMatchNum;
  const isDoubles = ['MD', 'WD', 'XD'].includes(format);
  
  const rounds = [
    { count: round1Count / 2, name: 'Round 2' },
    { count: round1Count / 4, name: 'Quarterfinals' },
    { count: round1Count / 8, name: 'Semifinals' },
    { count: 1, name: 'Final' }
  ].filter(r => r.count >= 1);
  
  rounds.forEach(round => {
    for (let i = 0; i < round.count; i++) {
      const match = {
        Match_ID: `${format}_${matchNum}`,
        Round: round.name,
        Status: 'scheduled',
        Score_1: '',
        Winner: ''
      };
      
      if (isDoubles) {
        match.Players_1 = 'TBD';
        match.Players_2 = 'TBD';
      } else {
        match.Player_1 = 'TBD';
        match.Player_2 = 'TBD';
      }
      
      matches.push(match);
      matchNum++;
    }
  });
  
  return matches;
}

function generateFormatMatches(format, count) {
  const isDoubles = ['MD', 'WD', 'XD'].includes(format);
  const isFemale = format === 'WS' || format === 'WD';
  
  // Determine bracket size (next power of 2)
  let bracketSize = 4;
  while (bracketSize < count) bracketSize *= 2;
  
  const participants = isDoubles 
    ? generateTeams(count, format)
    : generatePlayers(count, isFemale);
  
  const { matches: round1, matchNum } = createRound1Matches(format, participants, bracketSize);
  const laterRounds = createSubsequentRounds(format, round1.length, matchNum);
  
  return [...round1, ...laterRounds];
}

function generateTournamentData() {
  const tournament = {
    formats: ['MS', 'WS', 'MD', 'WD', 'XD'],
    lastUpdated: new Date().toISOString(),
    config: {
      eventName: 'Farewell Tournament 2026',
      venue: 'IISc Gymkhana'
    },
    players: {},
    matches: {
      MS: generateFormatMatches('MS', 16),
      WS: generateFormatMatches('WS', 8),
      MD: generateFormatMatches('MD', 8),
      WD: generateFormatMatches('WD', 6),
      XD: generateFormatMatches('XD', 7)
    }
  };
  
  return tournament;
}

// Generate and output
const tournamentData = generateTournamentData();
console.log(JSON.stringify(tournamentData, null, 2));

// For Node.js file writing
if (typeof require !== 'undefined') {
  const fs = require('fs');
  fs.writeFileSync('tournament-data.json', JSON.stringify(tournamentData, null, 2));
  console.log('\n✅ Tournament data generated and saved to tournament-data.json');
}
