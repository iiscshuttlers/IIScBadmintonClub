import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.TEST_DATABASE_URL
  ?? 'postgresql://supabase_admin:postgres@127.0.0.1:54329/test_db';

const tournamentId = '10000000-0000-0000-0000-000000000031';
const matchId = '20000000-0000-0000-0000-000000000031';
const scorerOne = '30000000-0000-0000-0000-000000000031';
const scorerTwo = '30000000-0000-0000-0000-000000000032';

async function connect(userId = null) {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
  return client;
}

async function main() {
  const setup = await connect();
  await setup.query('BEGIN');
  try {
    await setup.query(`
      INSERT INTO public.players (id, full_name, email, role)
      VALUES
        ($1, 'Concurrent Scorer One', 'race1@example.test', 'umpire'),
        ($2, 'Concurrent Scorer Two', 'race2@example.test', 'umpire')
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role
    `, [scorerOne, scorerTwo]);
    await setup.query(`
      INSERT INTO public.tournaments (id, status, start_date, venue, format_family, tournament_type)
      VALUES ($1, 'published', CURRENT_DATE, 'Concurrency Hall', 'knockout', 'singles')
      ON CONFLICT (id) DO NOTHING
    `, [tournamentId]);

    await setup.query(`
      INSERT INTO public.tournament_matches (
        id, tournament_id, match_code, status, team1_label, team2_label,
        points_to_win, best_of_sets, golden_point, umpired_by
      ) VALUES ($1, $2, 'LOCK-RACE', 'in_progress', 'Side A', 'Side B', 21, 3, 30, NULL)
      ON CONFLICT (id) DO UPDATE SET status = 'in_progress', umpired_by = NULL;
    `, [matchId, tournamentId]);

    await setup.query(`
      INSERT INTO public.tournament_officials (tournament_id, user_id, role)
      SELECT $1, scorer_id, 'UMPIRE'
      FROM unnest(ARRAY[$2::uuid, $3::uuid]) scorer_id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.tournament_officials existing
        WHERE existing.tournament_id = $1 AND existing.user_id = scorer_id
      );
    `, [tournamentId, scorerOne, scorerTwo]);
    await setup.query('COMMIT');
  } catch (error) {
    await setup.query('ROLLBACK');
    throw error;
  } finally {
    await setup.end();
  }

  const first = await connect(scorerOne);
  const second = await connect(scorerTwo);
  const publish = client => client.query(
    `SELECT public.upsert_live_match_by_id($1, $2::jsonb)`,
    [matchId, JSON.stringify({ isFriendly: false, status: 'in_progress', score: [1, 0] })],
  );

  try {
    const results = await Promise.allSettled([publish(first), publish(second)]);
    const successes = results.filter(result => result.status === 'fulfilled');
    const failures = results.filter(result => result.status === 'rejected');

    if (successes.length !== 1 || failures.length !== 1) {
      throw new Error(`expected one scorer to win and one to fail; got ${successes.length} success(es), ${failures.length} failure(s)`);
    }

    const failure = failures[0].reason;
    if (failure?.code !== '55000' || !String(failure.message).startsWith('scorer_locked:')) {
      throw failure;
    }

    const verify = await connect();
    try {
      const ownership = await verify.query(
        'SELECT umpired_by::text AS scorer FROM public.tournament_matches WHERE id = $1',
        [matchId],
      );
      if (![scorerOne, scorerTwo].includes(ownership.rows[0]?.scorer)) {
        throw new Error(`unexpected scorer owner: ${ownership.rows[0]?.scorer}`);
      }
      console.log(`single scorer concurrency passed; winner=${ownership.rows[0].scorer}; loser_error=${failure.code}`);
    } finally {
      await verify.end();
    }
  } finally {
    await first.end();
    await second.end();
  }
}

main().catch(error => {
  console.error('single scorer concurrency failed', error);
  process.exitCode = 1;
});
