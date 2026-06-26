import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle, Trophy, Save, Sparkles, Activity, Swords,
  Video, LogOut, ArrowLeft, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BasicInfoTab } from "@/components/profile/BasicInfoTab";
import { GameStatsTab } from "@/components/profile/GameStatsTab";
import { EquipmentTab } from "@/components/profile/EquipmentTab";
import { HighlightsTab } from "@/components/profile/HighlightsTab";
import { MediaTab } from "@/components/profile/MediaTab";
import { useProfileSetup } from "@/hooks/useProfileSetup";

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const setup = useProfileSetup();

  if (setup.isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!setup.session) return null; // Wait for redirect

  const tabs = [
    { id: "basic", label: "Basic Info", icon: UserCircle },
    { id: "badminton", label: "Game Stats", icon: Activity },
    { id: "equipment", label: "Equipment", icon: Swords },
    { id: "highlights", label: "Highlights", icon: Trophy },
    { id: "media", label: "Media Showcase", icon: Video },
  ];

  const tabOrder = tabs.map((t) => t.id);
  const currentIndex = tabOrder.indexOf(setup.activeTab);
  const isLastTab = currentIndex === tabOrder.length - 1;
  const nextTabId = isLastTab ? null : tabOrder[currentIndex + 1];
  const nextTabObj = tabs.find((t) => t.id === nextTabId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 sm:mb-8">
            <div className="text-center sm:text-left min-w-0">
              {setup.isEditing && (setup.playerSlug || setup.paramId) && (
                <button
                  onClick={() => setLocation(`/player/${setup.playerSlug || setup.paramId}`)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 mb-3 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Profile
                </button>
              )}
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2 leading-tight">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-500 animate-pulse shrink-0" />
                {setup.isEditing ? "Edit Your Player Profile" : "Complete Your Profile"}
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400 text-base sm:text-lg">
                {setup.isEditing
                  ? "Keep your badminton card updated with your latest achievements!"
                  : "Welcome to IISc Badminton Club! Tell us about your game."}
              </p>
            </div>

            <button
              type="button"
              onClick={setup.handleSignOut}
              className="self-center sm:self-auto flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl text-sm font-semibold border border-rose-100 dark:border-rose-900/30 transition shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          {/* Sleek Tab Navigation */}
          <div className="-mx-4 sm:mx-0 px-4 sm:px-0 grid grid-cols-2 md:flex md:flex-wrap border-b border-slate-200 dark:border-slate-800 mb-6 sm:mb-8 gap-2 pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = setup.activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setup.setActiveTab(tab.id as any)}
                  className={`snap-start shrink-0 flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 font-semibold text-sm rounded-xl transition-all whitespace-nowrap outline-none
                    ${isActive
                      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-500"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/50"
                    }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-5 sm:p-8">
            <form onSubmit={setup.handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {setup.activeTab === "basic" && (
                  <BasicInfoTab
                    avatarUrl={setup.avatarUrl} setAvatarUrl={setup.setAvatarUrl}
                    fullName={setup.fullName} setFullName={setup.setFullName}
                    nickname={setup.nickname} setNickname={setup.setNickname}
                    iiscEmail={setup.iiscEmail} setIiscEmail={setup.setIiscEmail}
                    contactNumber={setup.contactNumber} setContactNumber={setup.setContactNumber}
                    gender={setup.gender} setGender={setup.setGender}
                    joinedYear={setup.joinedYear} setJoinedYear={setup.setJoinedYear}
                    isGuest={setup.isGuest} setIsGuest={setup.setIsGuest}
                    department={setup.department} setDepartment={setup.setDepartment}
                    customDepartment={setup.customDepartment} setCustomDepartment={setup.setCustomDepartment}
                    isRetired={setup.isRetired} setIsRetired={setup.setIsRetired}
                    handleAvatarUpload={setup.handleAvatarUpload}
                  />
                )}

                {setup.activeTab === "badminton" && (
                  <GameStatsTab
                    playingLevel={setup.playingLevel} setPlayingLevel={setup.setPlayingLevel}
                    playingStyle={setup.playingStyle} setPlayingStyle={setup.setPlayingStyle}
                    dominantHand={setup.dominantHand} setDominantHand={setup.setDominantHand}
                    favoriteShot={setup.favoriteShot} setFavoriteShot={setup.setFavoriteShot}
                    yearsPlaying={setup.yearsPlaying} setYearsPlaying={setup.setYearsPlaying}
                    coach={setup.coach} setCoach={setup.setCoach}
                    favoriteIdol={setup.favoriteIdol} setFavoriteIdol={setup.setFavoriteIdol}
                    favoriteFormat={setup.favoriteFormat} setFavoriteFormat={setup.setFavoriteFormat}
                  />
                )}

                {setup.activeTab === "equipment" && (
                  <EquipmentTab
                    rackets={setup.rackets} setRackets={setup.setRackets}
                    primaryRacketIndex={setup.primaryRacketIndex} setPrimaryRacketIndex={setup.setPrimaryRacketIndex}
                    shoesList={setup.shoesList} setShoesList={setup.setShoesList}
                    primaryShoeIndex={setup.primaryShoeIndex} setPrimaryShoeIndex={setup.setPrimaryShoeIndex}
                    apparel={setup.apparel} setApparel={setup.setApparel}
                  />
                )}

                {setup.activeTab === "highlights" && (
                  <HighlightsTab
                    bio={setup.bio} setBio={setup.setBio}
                    quote={setup.quote} setQuote={setup.setQuote}
                    tournamentsRaw={setup.tournamentsRaw} setTournamentsRaw={setup.setTournamentsRaw}
                    tourName={setup.tourName} setTourName={setup.setTourName}
                    tourYear={setup.tourYear} setTourYear={setup.setTourYear}
                    achievementsRaw={setup.achievementsRaw} setAchievementsRaw={setup.setAchievementsRaw}
                    achCategory={setup.achCategory} setAchCategory={setup.setAchCategory}
                    achEventType={setup.achEventType} setAchEventType={setup.setAchEventType}
                    achMedal={setup.achMedal} setAchMedal={setup.setAchMedal}
                    achCustomMedal={setup.achCustomMedal} setAchCustomMedal={setup.setAchCustomMedal}
                    achTournament={setup.achTournament} setAchTournament={setup.setAchTournament}
                    careerHighlights={setup.careerHighlights} setCareerHighlights={setup.setCareerHighlights}
                  />
                )}

                {setup.activeTab === "media" && (
                  <MediaTab
                    mediaImages={setup.mediaImages} setMediaImages={setup.setMediaImages}
                    imagePreviewStatus={setup.imagePreviewStatus} setImagePreviewStatus={setup.setImagePreviewStatus}
                    mediaVideos={setup.mediaVideos} setMediaVideos={setup.setMediaVideos}
                    videoPreviewIds={setup.videoPreviewIds} setVideoPreviewIds={setup.setVideoPreviewIds}
                    handleImageBlur={setup.handleImageBlur} handleVideoBlur={setup.handleVideoBlur}
                  />
                )}
              </AnimatePresence>

              <div className="pt-5 sm:pt-6 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                {isLastTab ? (
                  <Button
                    type="submit"
                    disabled={setup.loading}
                    className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-base sm:text-lg flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {setup.loading ? (
                      <>
                        <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save & Launch Profile
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setup.setActiveTab(nextTabId as any);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="w-full min-h-[52px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition-all text-base sm:text-lg flex items-center justify-center gap-2"
                  >
                    Save & Next: {nextTabObj?.label} <ArrowRight className="w-5 h-5" />
                  </Button>
                )}

                <button
                  type="button"
                  onClick={(e) => setup.handleSubmit(e as any)}
                  disabled={setup.loading}
                  className="min-h-[52px] px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  Complete profile later, Launch for now
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
