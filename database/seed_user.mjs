import { Client } from 'pg';

const dbUrl = 'postgresql://postgres.htejmhsqqlfedlajqqyv:OldDB_Password_123!@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';

async function seed() {
  const client = new Client(dbUrl);
  await client.connect();
  
  try {
    const wrongId = 'c867f9af-bc61-46e2-ad87-6a094726644e';
    const correctId = '1a0b56fa-25ff-4b50-b9b1-0867f07d1b8b';
    
    // Delete the wrong one first just in case
    await client.query(`DELETE FROM players WHERE id = $1`, [wrongId]);
    
    await client.query(`
      INSERT INTO players (
        id, full_name, nickname, avatar_url, department, joined_year, 
        playing_level, dominant_hand, playing_style, favorite_shot, 
        favorite_idol, quote, current_racket, nationality, home_state, 
        height, years_playing, coach, bio, current_ranking, highest_ranking, 
        shoes, apparel, instagram, email, racket_details, tournament_history, 
        achievements, stats, recent_form, recent_matches, frequent_partners, career_highlights, win_loss_record
      ) VALUES (
        $1,
        'Raja Janmejay',
        'Jordan',
        'https://i.pravatar.cc/300?u=janmejay',
        'Aerospace Engineering',
        2022,
        'Advanced',
        'Right-handed',
        'Aggressive',
        'Net Cross Drop',
        'Viktor Axelsen',
        'Enjoying the Game is best strategy',
        'Apacs Finapi 232 Reborn',
        'Indian',
        'Bihar',
        '175 cm',
        8,
        'Self-coached',
        'PhD researcher at IISc Bengaluru. Started playing in 2018 — known for aggressive net play and quick reflexes at the front court.',
        3,
        2,
        'Yonex Power Cushion 65 Z3',
        'Yonex',
        '@raja_janmejay',
        'raja79sharma@gmail.com',
        '[{"name": "Apacs Finapi 232 Reborn", "string": "Victor VBS66 Nano", "tension": "28 lbs"}]'::jsonb,
        ARRAY['Farewell 2026', 'BPL 2026', 'Spectrum 2026'],
        ARRAY['Men''s Doubles Winner - Farewell 2026'],
        '{"totalMatches": 30, "wins": 24, "losses": 6, "winPercentage": 80, "titlesWon": 2, "runnerUp": 1, "semifinals": 1, "currentStreak": "W4", "longestWinStreak": 8, "categoryStats": {"singles": {"wins": 8, "losses": 3}, "doubles": {"wins": 12, "losses": 2}, "mixed": {"wins": 4, "losses": 1}}}'::jsonb,
        ARRAY['W', 'W', 'L', 'W', 'W'],
        '[{"date": "2026-03-15", "tournament": "Farewell 2026", "category": "Men''s Doubles", "round": "Final", "opponent": "A. Kumar / R. Sharma", "partner": "Suresh K.", "score": "21-18, 19-21, 21-15", "result": "W"}]'::jsonb,
        '[{"name": "Suresh Kumar", "id": "5", "matchesTogether": 12, "winRate": 75}]'::jsonb,
        '[{"year": 2026, "title": "Farewell 2026 Champion", "description": "Won Men''s Doubles title"}, {"year": 2025, "title": "Mixed Doubles Winner", "description": "Open Tournament 2025"}]'::jsonb,
        '24W - 6L'
      )
      ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
    `, [correctId]);
    
    console.log("Successfully seeded player with auth.users ID!");
  } catch (err) {
    console.error("Error seeding player:", err);
  } finally {
    await client.end();
  }
}

seed();
