const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'pages', 'PlayerProfile.tsx');
const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

const startIndex = 1283 - 1; 
const endIndex = 1664 - 1; 

const headerLines = lines.slice(startIndex, endIndex);

const headerComponent = `import { ArrowLeft, Trash2, Sparkles, Settings, LogOut, UserMinus, FileDown, Share2, Trophy, Instagram, MapPin, User, Users, Heart, CheckCircle, XCircle, Swords, UserCheck, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ProfileHeader({
  player,
  currentUser,
  ownPlayerProfile,
  isAdmin,
  isMainAdmin,
  targetUserRole,
  updateRole,
  handleAdminDelete,
  handleSelfDelete,
  handleWrapped,
  generatingWrapped,
  handleExportPdf,
  handleShare,
  eloRank,
  heroRestName,
  heroLastWord,
  theme,
  isFollowing,
  handleToggleFollow,
  isBuddy,
  hasReceivedRequest,
  hasSentRequest,
  handleBuddyAction,
  setIsChallengeModalOpen,
  activeTab,
  setActiveTab,
  setLocation,
  getEloTier,
  supabase,
  AnimatedCounter
}: any) {
  return (
    <>
${headerLines.join('\n')}
    </>
  );
}
`;

fs.writeFileSync(path.join(__dirname, 'client', 'src', 'components', 'player-profile', 'ProfileHeader.tsx'), headerComponent);

// Replace lines in original file
const newLines = [
  ...lines.slice(0, startIndex),
  `        <ProfileHeader
          player={player}
          currentUser={currentUser}
          ownPlayerProfile={ownPlayerProfile}
          isAdmin={isAdmin}
          isMainAdmin={isMainAdmin}
          targetUserRole={targetUserRole}
          updateRole={updateRole}
          handleAdminDelete={handleAdminDelete}
          handleSelfDelete={handleSelfDelete}
          handleWrapped={handleWrapped}
          generatingWrapped={generatingWrapped}
          handleExportPdf={handleExportPdf}
          handleShare={handleShare}
          eloRank={eloRank}
          heroRestName={heroRestName}
          heroLastWord={heroLastWord}
          theme={theme}
          isFollowing={isFollowing}
          handleToggleFollow={handleToggleFollow}
          isBuddy={isBuddy}
          hasReceivedRequest={hasReceivedRequest}
          hasSentRequest={hasSentRequest}
          handleBuddyAction={handleBuddyAction}
          setIsChallengeModalOpen={setIsChallengeModalOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setLocation={setLocation}
          getEloTier={getEloTier}
          supabase={supabase}
          AnimatedCounter={AnimatedCounter}
        />`,
  ...lines.slice(endIndex)
];

// Add import
const finalLines = [];
let imported = false;
for (let line of newLines) {
  if (!imported && line.includes('import { ChallengeModal }')) {
    finalLines.push('import { ProfileHeader } from "@/components/player-profile/ProfileHeader";');
    imported = true;
  }
  finalLines.push(line);
}

fs.writeFileSync(filePath, finalLines.join('\n'));
console.log('Extraction complete');
