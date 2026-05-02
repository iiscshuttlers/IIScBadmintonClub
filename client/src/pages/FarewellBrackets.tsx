import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';

// 1. Bracket Structure (Inlined to prevent fetch errors on GitHub Pages)
const BRACKET_STRUCTURE: any = {
  "MS": {
    "format": "Single Elimination",
    "rounds": [
      {
        "name": "Round 1 (Quarterfinals)",
        "matches": ["MS_1", "MS_2", "MS_3", "MS_4"]
      },
      {
        "name": "Round 2 (Semifinals)", 
        "matches": ["MS_5", "MS_6"],
        "connections": {
          "MS_5": { "from": ["MS_1", "MS_2"] },
          "MS_6": { "from": ["MS_3", "MS_4"] }
        }
      },
      {
        "name": "Round 3 (Final)",
        "matches": ["MS_7"],
        "connections": {
          "MS_7": { "from": ["MS_5", "MS_6"] }
        }
      }
    ]
  },
  "WS": {
    "format": "Single Elimination",
    "rounds": [
      {
        "name": "Round 1 (Quarterfinals)",
        "matches": ["WS_1", "WS_2", "WS_3", "WS_4"]
      },
      {
        "name": "Round 2 (Semifinals)",
        "matches": ["WS_5", "WS_6"],
        "connections": {
          "WS_5": { "from": ["WS_1", "WS_2"] },
          "WS_6": { "from": ["WS_3", "WS_4"] }
        }
      },
      {
        "name": "Round 3 (Final)",
        "matches": ["WS_7"],
        "connections": {
          "WS_7": { "from": ["WS_5", "WS_6"] }
        }
      }
    ]
  },
  "XD": {
    "format": "League + Knockout",
    "rounds": [
      {
        "name": "League Stage",
        "matches": ["XD_1", "XD_2", "XD_3", "XD_4", "XD_5", "XD_6", "XD_7", "XD_8", "XD_9", "XD_10", "XD_11", "XD_12", "XD_13", "XD_14", "XD_15"]
      },
      {
        "name": "Semifinals",
        "matches": ["XD_16", "XD_17"],
        "note": "Top 4 from league"
      },
      {
        "name": "Final",
        "matches": ["XD_18"],
        "connections": {
          "XD_18": { "from": ["XD_16", "XD_17"] }
        }
      }
    ]
  },
  "MD": {
    "format": "Round Robin",
    "rounds": [
      {
        "name": "League Stage",
        "matches": ["MD_1", "MD_2", "MD_3", "MD_4", "MD_5", "MD_6", "MD_7", "MD_8", "MD_9", "MD_10"]
      }
    ]
  },
  "WD": {
    "format": "League + Knockout",
    "rounds": [
      {
        "name": "League Stage",
        "matches": ["WD_1", "WD_2", "WD_3", "WD_4", "WD_5", "WD_6", "WD_7", "WD_8", "WD_9", "WD_10", "WD_11", "WD_12", "WD_13", "WD_14", "WD_15"]
      },
      {
        "name": "Semifinals",
        "matches": ["WD_16", "WD_17"],
        "note": "Top 4 from league"
      },
      {
        "name": "Final",
        "matches": ["WD_18"],
        "connections": {
          "WD_18": { "from": ["WD_16", "WD_17"] }
        }
      }
    ]
  }
};

// 2. Your Google Sheets Published CSV URLs (Fixed syntax error on MD)
const SHEETS_URLS = {
  MS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2oGpUY5417SR0alRBlWgV-iMu4nL1RSBZxp6Eltm7KXNawcPy-D7hTeaF_tuTKYhcYCFfyqe-TE0/pub?gid=850168809&single=true&output=csv',
  WS: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2oGpUY5417SR0alRBlWgV-iMu4nL1RSBZxp6Eltm7KXNawcPy-D7hTeaF_tuTKYhcYCFfyqe-TE0/pub?gid=2085483050&single=true&output=csv',
  XD: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2oGpUY5417SR0alRBlWgV-iMu4nL1RSBZxp6Eltm7KXNawcPy-D7hTeaF_tuTKYhcYCFfyqe-TE0/pub?gid=1547267114&single=true&output=csv',
  MD: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2oGpUY5417SR0alRBlWgV-iMu4nL1RSBZxp6Eltm7KXNawcPy-D7hTeaF_tuTKYhcYCFfyqe-TE0/pub?gid=301747562&single=true&output=csv',
  WD: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRi2oGpUY5417SR0alRBlWgV-iMu4nL1RSBZxp6Eltm7KXNawcPy-D7hTeaF_tuTKYhcYCFfyqe-TE0/pub?gid=1539434900&single=true&output=csv'
};

interface Match {
  Match_ID: string;
  Round: string;
  Player_1: string;
  Player_2: string;
  'Set-1': string;
  'Set-2': string;
  'Set-3': string;
  Winner: string;
  Status: string;
  Court: string;
  Date: string;
  Time: string;
}

export default function TournamentBrackets() {
  const [activeFormat, setActiveFormat] = useState('MS');
  const [matches, setMatches] = useState<{ [key: string]: Match[] }>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Load match data from Google Sheets
  useEffect(() => {
    loadAllMatches();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadAllMatches, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAllMatches = async () => {
    const allMatches: { [key: string]: Match[] } = {};
    
    for (const [format, url] of Object.entries(SHEETS_URLS)) {
      try {
        const response = await fetch(url);
        const csvText = await response.text();
        const rows = parseCSV(csvText);
        allMatches[format] = rows;
      } catch (error) {
        console.error(`Error loading ${format} matches:`, error);
        allMatches[format] = [];
      }
    }
    
    setMatches(allMatches);
    setLastUpdate(new Date());
    setLoading(false);
  };

  // 3. Updated CSV Parser to handle the 2-Row Header from Google Sheets
  const parseCSV = (csv: string): Match[] => {
    const lines = csv.split('\n');
    const headers = lines[0].split(',');

    // Change slice(1) to slice(2) to skip BOTH header rows in your sheet
    return lines.slice(2)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',');
        const raw: any = {};

        headers.forEach((header, i) => {
          const key = header.trim() || `col_${i}`; 
          raw[key] = values[i]?.trim() || '';
        });

        // Safely extract names for both Singles and Doubles
        const player1 = raw.Player_1 || [raw.Player_A1, raw.Player_A2].filter(Boolean).join(' & ');
        const player2 = raw.Player_2 || [raw.Player_B1, raw.Player_B2].filter(Boolean).join(' & ');

        // Stitch scores together from your split columns
        const set1 = raw['Set-1'] || (values[4] && values[5] ? `${values[4]}-${values[5]}` : '');
        const set2 = raw['Set-2'] || (values[6] && values[7] ? `${values[6]}-${values[7]}` : '');
        const set3 = raw['Set-3'] || (values[8] && values[9] ? `${values[8]}-${values[9]}` : '');

        return {
          Match_ID: raw.Match_ID || values[0]?.trim() || '',
          Round: raw.Round || values[1]?.trim() || '',
          Player_1: player1 || values[2]?.trim() || '',
          Player_2: player2 || values[10]?.trim() || '',
          'Set-1': set1,
          'Set-2': set2,
          'Set-3': set3,
          Winner: raw.Winner || values[12]?.trim() || '',
          Status: raw.Status || values[13]?.trim() || '',
          Court: raw.Court || values[14]?.trim() || '',
          Date: raw.Date || values[15]?.trim() || '',
          Time: raw.Time || values[17]?.trim() || '',
        };
      })
      .filter(match => match.Match_ID && !match.Match_ID.includes('Select'));
  };

  const renderBrackets = () => {
    // Replaced bracketStructure state with the constant BRACKET_STRUCTURE
    if (!BRACKET_STRUCTURE[activeFormat] || !matches[activeFormat]) return null;

    const structure = BRACKET_STRUCTURE[activeFormat];
    const formatMatches = matches[activeFormat];

    if (structure.format === 'Round Robin' || structure.format === 'League Stage') {
      return renderRoundRobin(formatMatches);
    } else if (structure.format === 'League + Knockout') {
      // For combined formats, render League first, then Knockout below it
      return (
        <div className="space-y-12">
          {renderRoundRobin(formatMatches)}
          <hr className="border-gray-200" />
          <h3 className="text-xl font-bold text-gray-800 mb-4">Knockout Stage</h3>
          {renderKnockout(structure, formatMatches)}
        </div>
      );
    } else {
      return renderKnockout(structure, formatMatches);
    }
  };

  const renderRoundRobin = (formatMatches: Match[]) => {
    // Only show league stage matches
    const leagueMatches = formatMatches.filter(m => !m.Round || m.Round === 'League Stage' || m.Match_ID.includes('_') && parseInt(m.Match_ID.split('_')[1]) <= 15);

    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-800">League Matches</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leagueMatches.map(match => (
            <MatchCard key={match.Match_ID} match={match} />
          ))}
        </div>
      </div>
    );
  };

  const renderKnockout = (structure: any, formatMatches: Match[]) => {
    const rounds = structure.rounds.filter((r: any) => r.name !== 'League Stage');
    
    return (
      <div className="overflow-x-auto pb-8">
        <div className="flex gap-8 min-w-max">
          {rounds.map((round: any, roundIdx: number) => (
            <div key={roundIdx} className="flex flex-col justify-around min-w-[300px]">
              <h3 className="text-lg font-bold text-center mb-4 text-gray-700">
                {round.name}
              </h3>
              <div className="flex flex-col justify-around gap-4 h-full">
                {round.matches.map((matchId: string) => {
                  const match = formatMatches.find(m => m.Match_ID === matchId);
                  
                  // Even if data isn't typed yet, render a placeholder card
                  if (!match) {
                     return <BracketMatchCard key={matchId} match={{ Match_ID: matchId } as Match} />;
                  }
                  
                  return (
                    <div key={matchId} className="relative">
                      <BracketMatchCard match={match} />
                      
                      {/* Connection lines to next round */}
                      {roundIdx < rounds.length - 1 && (
                        <div className="absolute top-1/2 -right-8 w-8 h-0.5 bg-gray-300" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p>Loading tournament data from Google Sheets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-emerald-50 py-8 px-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-xl p-6 border-t-4 border-emerald-600">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <Trophy className="w-8 h-8 text-yellow-500" />
                IISc Farewell Tournament 2026
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={loadAllMatches}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Format Tabs */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-lg p-4">
          <div className="flex flex-wrap gap-2">
            {['MS', 'WS', 'XD', 'MD', 'WD'].map(format => (
              <button
                key={format}
                onClick={() => setActiveFormat(format)}
                className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                  activeFormat === format
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {format}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Brackets */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6">
          {renderBrackets()}
        </div>
      </div>
    </div>
  );
}

// Match card for round robin view
function MatchCard({ match }: { match: Match }) {
  const getScoreDisplay = () => {
    const scores = [];
    if (match['Set-1']) scores.push(match['Set-1']);
    if (match['Set-2']) scores.push(match['Set-2']);
    if (match['Set-3']) scores.push(match['Set-3']);
    return scores.join(' | ');
  };

  const isCompleted = match.Status === 'completed';
  const isLive = match.Status === 'in-progress';

  return (
    <div className={`border-2 rounded-lg p-4 ${
      isLive ? 'border-yellow-400 bg-yellow-50' :
      isCompleted ? 'border-green-300 bg-green-50' :
      'border-gray-300 bg-white'
    }`}>
      <div className="text-xs text-gray-600 mb-2 flex justify-between">
        <span className="font-mono">{match.Match_ID}</span>
        <span>{match.Date} {match.Time}</span>
      </div>
      
      <div className="space-y-2">
        <div className={`flex justify-between p-2 rounded ${
          match.Winner && match.Winner === match.Player_1 ? 'bg-emerald-600 text-white font-bold' : 'bg-gray-50'
        }`}>
          <span>{match.Player_1 || 'TBD'}</span>
          {isCompleted && match.Winner === match.Player_1 && <Trophy className="w-4 h-4" />}
        </div>
        
        <div className="text-center text-sm font-semibold text-gray-700">
          {getScoreDisplay() || 'vs'}
        </div>
        
        <div className={`flex justify-between p-2 rounded ${
          match.Winner && match.Winner === match.Player_2 ? 'bg-emerald-600 text-white font-bold' : 'bg-gray-50'
        }`}>
          <span>{match.Player_2 || 'TBD'}</span>
          {isCompleted && match.Winner === match.Player_2 && <Trophy className="w-4 h-4" />}
        </div>
      </div>

      {isLive && (
        <div className="mt-2 text-center">
          <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full animate-pulse">
            🔴 LIVE
          </span>
        </div>
      )}
    </div>
  );
}

// Bracket match card for knockout view
function BracketMatchCard({ match }: { match: Match }) {
  const getScoreDisplay = () => {
    const scores = [];
    if (match['Set-1']) scores.push(match['Set-1']);
    if (match['Set-2']) scores.push(match['Set-2']);
    if (match['Set-3']) scores.push(match['Set-3']);
    return scores.join('  ');
  };

  const isCompleted = match.Status === 'completed';
  const isLive = match.Status === 'in-progress';

  return (
    <div className={`border-2 rounded-lg p-3 min-w-[280px] ${
      isLive ? 'border-yellow-400 bg-yellow-50 shadow-lg' :
      isCompleted ? 'border-green-300 bg-green-50' :
      'border-gray-300 bg-white'
    }`}>
      <div className="text-xs text-gray-600 mb-2 flex justify-between items-center">
        <span className="font-mono">{match.Match_ID}</span>
        {isLive && <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-xs animate-pulse">LIVE</span>}
      </div>
      
      <div className="space-y-1">
        <div className={`flex justify-between items-center p-2 rounded text-sm ${
          match.Winner && match.Winner === match.Player_1 ? 'bg-emerald-600 text-white font-bold' : 'bg-gray-50'
        }`}>
          <span className="truncate">{match.Player_1 || 'TBD'}</span>
          {isCompleted && match.Winner === match.Player_1 && <Trophy className="w-4 h-4 ml-2" />}
        </div>
        
        {getScoreDisplay() && (
          <div className="text-center text-xs font-mono text-gray-600 py-1">
            {getScoreDisplay()}
          </div>
        )}
        
        <div className={`flex justify-between items-center p-2 rounded text-sm ${
          match.Winner && match.Winner === match.Player_2 ? 'bg-emerald-600 text-white font-bold' : 'bg-gray-50'
        }`}>
          <span className="truncate">{match.Player_2 || 'TBD'}</span>
          {isCompleted && match.Winner === match.Player_2 && <Trophy className="w-4 h-4 ml-2" />}
        </div>
      </div>

      {match.Court && (
        <div className="text-xs text-gray-500 mt-2 text-center">
          {match.Court}
        </div>
      )}
    </div>
  );
}