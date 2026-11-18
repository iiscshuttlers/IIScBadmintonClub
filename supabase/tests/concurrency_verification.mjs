import pg from 'pg';
const { Client } = pg;

const connectionString = process.env.TEST_DATABASE_URL
  ?? 'postgresql://supabase_admin:postgres@127.0.0.1:54329/test_db';

function assertDatabaseError(error, expectedCode, expectedMessage) {
  if (error?.code !== expectedCode || !String(error?.message).includes(expectedMessage)) {
    throw error;
  }
}

async function createClient(userId = '00000000-0000-0000-0000-000000000001', email = 'admin@example.test') {
  const client = new Client({ connectionString });
  await client.connect();
  if (userId) {
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  }
  if (email) {
    await client.query(`SELECT set_config('request.jwt.claim.email', $1, false)`, [email]);
  }
  const claims = await client.query(`SELECT auth.uid()::text AS uid, auth.jwt()->>'email' AS email`);
  if ((userId ?? null) !== claims.rows[0].uid || (email ?? null) !== claims.rows[0].email) {
    throw new Error(`Session claim mismatch: ${JSON.stringify(claims.rows[0])}`);
  }
  return client;
}

async function run() {
  console.log('=== Starting Work Package 1 Concurrency & Authorization Harness ===\n');

  // 1. Setup Fresh Test Match
  const setupClient = await createClient();
  const testMatchId = '20000000-0000-0000-0000-000000000099';
  const tournId = '10000000-0000-0000-0000-000000000001';

  await setupClient.query(`
    DELETE FROM public.tournament_matches
    WHERE id IN (
      '20000000-0000-0000-0000-000000000099',
      '20000000-0000-0000-0000-000000000098',
      '20000000-0000-0000-0000-000000000081',
      '20000000-0000-0000-0000-000000000082'
    );
  `);

  await setupClient.query(`
    INSERT INTO public.tournament_matches (
      id, tournament_id, status, player1_id, player2_id, team1_label, team2_label,
      points_to_win, best_of_sets, golden_point, court_number, scheduled_at, result_revision
    ) VALUES (
      $1, $2, 'scheduled',
      '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
      'Player A', 'Player B', 21, 3, 30, 'C9', '2026-11-12T15:00:00Z', 0
    ) ON CONFLICT (id) DO UPDATE SET result_revision = 0, status = 'scheduled';
  `, [testMatchId, tournId]);
  await setupClient.end();

  // Test 1: Genuine Concurrent Revision Race (Task 5)
  console.log('Test 1: Simulating concurrent submissions with same expected revision (0)...');
  const session1 = await createClient();
  const session2 = await createClient();

  const promise1 = session1.query(`
    SELECT public.submit_tournament_match_v2(
      $1::uuid, 1::smallint, '21-15, 21-17', ARRAY['21-15', '21-17']::text[],
      NULL::uuid, 0::bigint, '40000000-0000-0000-0000-000000000091'::uuid
    ) as receipt;
  `, [testMatchId]);

  const promise2 = session2.query(`
    SELECT public.submit_tournament_match_v2(
      $1::uuid, 2::smallint, '15-21, 17-21', ARRAY['15-21', '17-21']::text[],
      NULL::uuid, 0::bigint, '40000000-0000-0000-0000-000000000092'::uuid
    ) as receipt;
  `, [testMatchId]);

  const results = await Promise.allSettled([promise1, promise2]);
  const succeeded = results.filter(r => r.status === 'fulfilled');
  const rejected = results.filter(r => r.status === 'rejected');

  console.log(`- Succeeded sessions: ${succeeded.length}`);
  console.log(`- Rejected sessions: ${rejected.length}`);

  if (succeeded.length === 1 && rejected.length === 1) {
    console.log('✓ Success: Exactly one submission succeeded and one was rejected.');
    console.log(`  Winning receipt:`, JSON.stringify(succeeded[0].value.rows[0].receipt));
    console.log(`  Rejected error message:`, rejected[0].reason.message);
  } else {
    throw new Error(`Concurrency assertion failed! Succeeded: ${succeeded.length}, Rejected: ${rejected.length}`);
  }

  await session1.end();
  await session2.end();

  // Test 2: Concurrent Overlapping Court Reservations (Task 6)
  console.log('\nTest 2: Simulating concurrent overlapping court reservations on Court C8...');
  const courtSession1 = await createClient();
  const courtSession2 = await createClient();

  const m1Id = '20000000-0000-0000-0000-000000000081';
  const m2Id = '20000000-0000-0000-0000-000000000082';

  const courtP1 = courtSession1.query(`
    INSERT INTO public.tournament_matches (
      id, tournament_id, match_code, status, team1_label, team2_label,
      points_to_win, best_of_sets, golden_point, court_number, scheduled_at
    ) VALUES ($1, $2, 'RACE-1', 'scheduled', 'T1', 'T2', 21, 3, 30, 'C8', '2026-11-12T16:00:00Z');
  `, [m1Id, tournId]);

  const courtP2 = courtSession2.query(`
    INSERT INTO public.tournament_matches (
      id, tournament_id, match_code, status, team1_label, team2_label,
      points_to_win, best_of_sets, golden_point, court_number, scheduled_at
    ) VALUES ($1, $2, 'RACE-2', 'scheduled', 'T3', 'T4', 21, 3, 30, 'C8', '2026-11-12T16:15:00Z');
  `, [m2Id, tournId]);

  const courtResults = await Promise.allSettled([courtP1, courtP2]);
  const courtSucceeded = courtResults.filter(r => r.status === 'fulfilled');
  const courtRejected = courtResults.filter(r => r.status === 'rejected');

  console.log(`- Succeeded court reservations: ${courtSucceeded.length}`);
  console.log(`- Rejected court reservations: ${courtRejected.length}`);

  if (courtSucceeded.length === 1 && courtRejected.length === 1) {
    console.log('✓ Success: Transaction lock serialized reservations; overlap was blocked.');
    console.log(`  Rejected court conflict error:`, courtRejected[0].reason.message);
  } else {
    throw new Error(`Court concurrency assertion failed! Succeeded: ${courtSucceeded.length}, Rejected: ${courtRejected.length}`);
  }

  await courtSession1.end();
  await courtSession2.end();

  // Test 3: Privileged RPC Authorization Checks (Task 8)
  console.log('\nTest 3: Checking authorization boundaries on start_tournament_match_checked...');
  const authMatchId = '20000000-0000-0000-0000-000000000098';
  const authSetup = await createClient();
  await authSetup.query(`
    INSERT INTO public.tournament_matches (
      id, tournament_id, status, player1_id, player2_id, team1_label, team2_label,
      points_to_win, best_of_sets, golden_point, court_number, scheduled_at
    ) VALUES (
      $1, $2, 'scheduled',
      '30000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000012',
      'Auth Player A', 'Auth Player B', 21, 3, 30, 'C10', '2026-11-12T18:00:00Z'
    ) ON CONFLICT (id) DO UPDATE SET status = 'scheduled', started_at = NULL;
  `, [authMatchId, tournId]);
  await authSetup.end();
  
  // 3a. Anonymous call
  const anonClient = await createClient(null, null);
  try {
    await anonClient.query(`
      SELECT public.start_tournament_match_checked($1::uuid, 'C10', NULL::timestamptz);
    `, [authMatchId]);
    throw new Error('Anonymous call unexpectedly succeeded!');
  } catch (err) {
    assertDatabaseError(err, '42501', 'Authentication required');
    console.log('✓ Anonymous call properly rejected:', err.message);
  }
  await anonClient.end();

  // 3b. Unauthorized player call
  const playerClient = await createClient('30000000-0000-0000-0000-000000000002', 'player@example.test');
  try {
    await playerClient.query(`
      SELECT public.start_tournament_match_checked($1::uuid, 'C10', NULL::timestamptz);
    `, [authMatchId]);
    throw new Error('Unauthorized player call unexpectedly succeeded!');
  } catch (err) {
    assertDatabaseError(err, '42501', 'Not authorized');
    console.log('✓ Unauthorized player call properly rejected:', err.message);
  }

  try {
    await playerClient.query(`
      SELECT public.submit_tournament_match_v2(
        $1::uuid, 1::smallint, '21-10, 21-10', ARRAY['21-10', '21-10']::text[],
        NULL::uuid, 0::bigint, '40000000-0000-0000-0000-000000000098'::uuid
      );
    `, [authMatchId]);
    throw new Error('Unauthorized result submission unexpectedly succeeded!');
  } catch (err) {
    assertDatabaseError(err, '42501', 'Not authorized');
    console.log('✓ Unauthorized result submission properly rejected:', err.message);
  }
  await playerClient.end();

  console.log('\n=== All Work Package 1 Concurrency & Authorization Assertions PASSED ===');
}

run().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});

