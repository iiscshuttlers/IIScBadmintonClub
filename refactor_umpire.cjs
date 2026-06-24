const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/hooks/useUmpireState.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add MatchService import
if (!content.includes('import { MatchService }')) {
  content = content.replace(
    'import { supabase } from "@/lib/supabase";',
    'import { supabase } from "@/lib/supabase";\nimport { MatchService } from "@/services/matchService";'
  );
}

// 2. Replace upsert_live_match
content = content.replace(
  /const\s*\{\s*error\s*\}\s*=\s*await\s*supabase\.rpc\("upsert_live_match",\s*\{\s*umpire_user_id:\s*userId,\s*match_state:\s*next\s*as\s*unknown\s*as\s*Record<string,\s*unknown>,\s*\}\);/g,
  'await MatchService.upsertLiveMatch(userId, next).catch(err => { toast.error("Broadcast sync failed — check your connection"); });\n      const error = false;'
);

// 3. Replace umpire_update_match
content = content.replace(
  /const\s*\{\s*error:\s*updateError\s*\}\s*=\s*await\s*supabase\.rpc\("umpire_update_match",\s*\{[\s\S]*?\}\);/g,
  'await MatchService.updateMatch(match.dbId, winnerId, finalScoreStr, match.category, match.setsHistory);\n          const updateError = null;'
);

// 4. Replace umpire_submit_match
content = content.replace(
  /const\s*\{\s*data:\s*submitId,\s*error:\s*submitError\s*\}\s*=\s*await\s*supabase\.rpc\("umpire_submit_match",\s*payload\);/g,
  'const submitId = await MatchService.submitMatch(payload);\n          const submitError = null;'
);

// 5. Replace confirm_friendly_match
content = content.replace(
  /await\s*supabase\.rpc\("confirm_friendly_match",\s*\{\s*match_uuid:\s*newMatchId\s*\}\);/g,
  'await MatchService.confirmFriendlyMatch(newMatchId);'
);

// 6. Replace remove_live_match
content = content.replace(
  /await\s*supabase\.rpc\("remove_live_match",\s*\{\s*umpire_user_id:\s*userId\s*\}\);/g,
  'await MatchService.removeLiveMatch(userId);'
);

// 7. Remove 'if (error) toast.error("Broadcast sync failed — check your connection");' from updateMatch
content = content.replace(
  /if\s*\(error\)\s*toast\.error\("Broadcast sync failed — check your connection"\);/g,
  ''
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully refactored useUmpireState.tsx with MatchService!');
