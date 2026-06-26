import type { PlayerRow } from "@/types/player";
import type { MatchWithPlayers } from "@/types/match";

export interface PredictionResult {
  p1WinProbability: number;
  p2WinProbability: number;
  punditCommentary: string;
}

/**
 * Calculates win probability based on standard ELO formula.
 * Formula: 1 / (1 + 10 ^ ((EloB - EloA) / 400))
 */
function calculateEloProbability(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Generates an AI-driven pundit prediction using heuristics and dynamic string templates.
 */
export function generateMatchPrediction(
  p1: PlayerRow,
  p2: PlayerRow,
  p1Wins: number,
  p2Wins: number,
  h2hMatches: MatchWithPlayers[] // Ascending chronological order expected
): PredictionResult {
  const p1Elo = p1.elo_rating ?? 1200;
  const p2Elo = p2.elo_rating ?? 1200;

  // 1. Base ELO Probability
  let p1Prob = calculateEloProbability(p1Elo, p2Elo);

  // 2. Head-to-Head Momentum Adjustment
  // A strong H2H record shifts the probability up to 10% towards the dominator.
  const totalMatches = p1Wins + p2Wins;
  if (totalMatches >= 3) {
    const p1WinRatio = p1Wins / totalMatches;
    // Shift probability by max 10% based on how far from 50/50 the H2H is
    const h2hShift = (p1WinRatio - 0.5) * 0.20; 
    p1Prob += h2hShift;
  }

  // Ensure bounds
  p1Prob = Math.max(0.05, Math.min(0.95, p1Prob));
  const p2Prob = 1 - p1Prob;

  // 3. Pundit Commentary Generation
  let commentary = "";

  const p1Name = p1.full_name.split(" ")[0];
  const p2Name = p2.full_name.split(" ")[0];
  const eloDiff = Math.abs(p1Elo - p2Elo);
  
  const favorite = p1Prob > p2Prob ? p1Name : p2Name;
  const underdog = p1Prob > p2Prob ? p2Name : p1Name;
  const favoriteProb = Math.max(p1Prob, p2Prob);

  // Intro based on ELO Gap
  if (eloDiff > 300) {
    commentary += `This matchup is a true David vs. Goliath scenario. ${favorite} holds a massive rating advantage and enters as the heavy favorite. `;
  } else if (eloDiff < 50) {
    commentary += `A blockbuster clash! On paper, there is virtually nothing separating ${p1Name} and ${p2Name}. This one could easily go the distance. `;
  } else {
    commentary += `${favorite} enters this match as the statistical favorite, but ${underdog} has the tools to make it highly competitive. `;
  }

  // H2H Context
  if (totalMatches >= 3) {
    if (p1Wins === 0 || p2Wins === 0) {
      const dominator = p1Wins > 0 ? p1Name : p2Name;
      const dominated = p1Wins > 0 ? p2Name : p1Name;
      commentary += `${dominator} holds a commanding ${Math.max(p1Wins, p2Wins)}-0 psychological advantage over ${dominated}, which will be a massive mental hurdle to overcome today. `;
    } else if (p1Wins === p2Wins) {
      commentary += `Their head-to-head record is perfectly deadlocked at ${p1Wins}-${p2Wins}, proving their styles clash brilliantly. `;
    } else {
      const leader = p1Wins > p2Wins ? p1Name : p2Name;
      commentary += `${leader} currently leads the head-to-head series, giving them slight momentum. `;
    }
  }

  // Playstyle matchups (if data exists)
  if (p1.playing_style && p2.playing_style) {
    const style1 = p1.playing_style.toLowerCase();
    const style2 = p2.playing_style.toLowerCase();
    if (style1.includes("aggressive") && style2.includes("defensive")) {
      commentary += `Keep an eye on the tactical battle: ${p1Name}'s aggressive shot-making against ${p2Name}'s defensive wall. `;
    } else if (style2.includes("aggressive") && style1.includes("defensive")) {
      commentary += `The tactical dynamic will be fascinating: ${p2Name}'s aggressive onslaught versus ${p1Name}'s defensive resilience. `;
    }
  }

  // Final Verdict
  if (favoriteProb > 0.8) {
    commentary += `Expect ${favorite} to dictate the pace and comfortably take the win.`;
  } else if (favoriteProb > 0.6) {
    commentary += `${favorite} should edge this out, but ${underdog} will absolutely capitalize on any unforced errors.`;
  } else {
    commentary += `Prediction models are split—this match is too close to call and will likely be decided in the crucial final points!`;
  }

  return {
    p1WinProbability: Math.round(p1Prob * 100),
    p2WinProbability: Math.round(p2Prob * 100),
    punditCommentary: commentary.trim(),
  };
}

/**
 * Calls the Google Gemini 2.5 Flash API to generate a deep pundit analysis.
 */
export async function fetchGeminiPunditAnalysis(
  p1: PlayerRow,
  p2: PlayerRow,
  p1Wins: number,
  p2Wins: number
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_GEMINI_API_KEY in environment variables.");
  }

  const prompt = `
Act as a highly analytical and slightly dramatic sports pundit analyzing an upcoming badminton match.

Here are the details for the two players:
Player 1: ${p1.full_name}
- ELO Rating: ${p1.elo_rating || 1200}
- Playing Style: ${p1.playing_style || "Balanced"}
- Dominant Hand: ${p1.dominant_hand || "Right-handed"}

Player 2: ${p2.full_name}
- ELO Rating: ${p2.elo_rating || 1200}
- Playing Style: ${p2.playing_style || "Balanced"}
- Dominant Hand: ${p2.dominant_hand || "Right-handed"}

Head to Head Record:
${p1.full_name} has won ${p1Wins} times.
${p2.full_name} has won ${p2Wins} times.

Write a highly engaging, hyped-up sports prediction for this match in STRICTLY 20 to 30 words. Briefly mention their clash and edge.
Do not use markdown formatting like bolding or headers, just plain text.
  `.trim();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("AI Quota Exceeded. The free tier limit has been reached. Please try again later.");
      }
      const errText = await response.text();
      throw new Error(`Failed to generate AI analysis: ${response.statusText} - ${errText}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates.length > 0) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error("Invalid response from Gemini API.");
  } catch (err: any) {
    throw new Error(err.message || "Network error while connecting to Gemini AI.");
  }
}

