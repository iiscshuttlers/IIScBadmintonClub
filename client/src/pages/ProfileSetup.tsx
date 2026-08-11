import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCircle, Trophy, Save, Sparkles, Activity, Swords,
  Video, LogOut, ArrowLeft, ArrowRight, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BasicInfoTab } from "@/components/profile/BasicInfoTab";
import { GameStatsTab } from "@/components/profile/GameStatsTab";
import { EquipmentTab } from "@/components/profile/EquipmentTab";
import { HighlightsTab } from "@/components/profile/HighlightsTab";
import { MediaTab } from "@/components/profile/MediaTab";
import { StatusTab } from "@/components/profile/StatusTab";
import { useProfileSetup } from "@/hooks/useProfileSetup";

export default function ProfileSetup() {
  const [, setLocation] = useLocation();
  const setup = useProfileSetup();

  if (setup.isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!setup.session) return null; // Wait for redirect

  const allTabs = [
    { id: "basic", label: "Basic Info", icon: UserCircle },
    { id: "status", label: "Account Status", icon: Settings },
    { id: "badminton", label: "Game Stats", icon: Activity },
    { id: "equipment", label: "Equipment", icon: Swords },
    { id: "highlights", label: "Highlights", icon: Trophy },
    { id: "media", label: "Media Showcase", icon: Video },
  ];

  const tabs = setup.isEditing ? allTabs : allTabs.filter(t => t.id === "basic");

  const tabOrder = tabs.map((t) => t.id);
  const currentIndex = tabOrder.indexOf(setup.activeTab);
  const isLastTab = currentIndex === tabOrder.length - 1;
  const nextTabId = isLastTab ? null : tabOrder[currentIndex + 1];
  const nextTabObj = tabs.find((t) => t.id === nextTabId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 sm:py-12 px-4 sm:px-6 lg:px-6">
      <div className="max-w-3xl mx-auto">
        {!setup.isEditing && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm">
            <h3 className="text-amber-800 dark:text-amber-300 font-bold text-sm sm:text-base">Account Created!</h3>
            <p className="text-amber-700 dark:text-amber-400/80 text-sm mt-1">
              Your email is registered, but you must complete your basic profile details before entering the club.
            </p>
          </div>
        )}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 sm:mb-8">
            <div className="text-center sm:text-left min-w-0">
              {setup.isEditing && (setup.playerSlug || setup.paramId) && (
                <button
                  onClick={() => setLocation(`/player/${setup.playerSlug || setup.paramId}`)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary dark:text-muted-foreground dark:hover:text-primary mb-3 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Profile
                </button>
              )}
              <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground dark:text-foreground flex items-center justify-center sm:justify-start gap-2 leading-tight">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-primary animate-pulse shrink-0" />
                {setup.isEditing ? "Edit Your Player Profile" : "Complete Your Profile"}
              </h1>
              <p className="mt-2 text-muted-foreground dark:text-muted-foreground text-base sm:text-lg">
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
          {tabs.length > 1 && (
            <div className="-mx-4 sm:mx-0 px-4 sm:px-0 mb-6 sm:mb-8 space-y-6">
              <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-[11px] font-black tracking-widest uppercase text-muted-foreground ml-1">Essential Information</h3>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  {tabs.filter(t => t.id === "basic").map((tab, index, arr) => {
                    const Icon = tab.icon;
                    const isActive = setup.activeTab === tab.id;
                    const isLastOdd = index === arr.length - 1 && arr.length % 2 !== 0;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setup.setActiveTab(tab.id as any)}
                        className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 font-semibold text-sm rounded-xl transition-all outline-none border shadow-sm
                          ${isLastOdd ? "col-span-2" : "col-span-1"}
                          ${isActive
                            ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary border-primary ring-1 ring-primary"
                            : "bg-white dark:bg-slate-800/80 text-muted-foreground border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                          }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-[11px] font-black tracking-widest uppercase text-muted-foreground ml-1">Detailed Profile</h3>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  {tabs.filter(t => t.id !== "basic").map((tab, index, arr) => {
                    const Icon = tab.icon;
                    const isActive = setup.activeTab === tab.id;
                    const isLastOdd = index === arr.length - 1 && arr.length % 2 !== 0;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setup.setActiveTab(tab.id as any)}
                        className={`flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-2.5 font-semibold text-sm rounded-xl transition-all outline-none border shadow-sm
                          ${isLastOdd ? "col-span-2" : "col-span-1"}
                          ${isActive
                            ? "bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary border-primary ring-1 ring-primary"
                            : "bg-white dark:bg-slate-800/80 text-muted-foreground border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                          }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-5 sm:p-6">
            <form onSubmit={setup.handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {setup.activeTab === "basic" && (
                  <BasicInfoTab
                    avatarUrl={setup.avatarUrl} setAvatarUrl={setup.setAvatarUrl}
                    handleAvatarUpload={setup.handleAvatarUpload}
                    fullName={setup.fullName} setFullName={setup.setFullName}
                    nickname={setup.nickname} setNickname={setup.setNickname}
                    iiscEmail={setup.iiscEmail} setIiscEmail={setup.setIiscEmail}
                    contactNumber={setup.contactNumber} setContactNumber={setup.setContactNumber}
                    gender={setup.gender} setGender={setup.setGender}
                    joinedYear={setup.joinedYear} setJoinedYear={setup.setJoinedYear}
                    department={setup.department} setDepartment={setup.setDepartment}
                    customDepartment={setup.customDepartment} setCustomDepartment={setup.setCustomDepartment}
                    isGuest={setup.isGuest}
                  />
                )}

                {setup.activeTab === "status" && (
                  <StatusTab
                    isGuest={setup.isGuest} setIsGuest={setup.setIsGuest}
                    isRetired={setup.isRetired} setIsRetired={setup.setIsRetired}
                    department={setup.department} setDepartment={setup.setDepartment}
                  />
                )}

                {setup.activeTab === "badminton" && (
                  <GameStatsTab
                    playingLevel={setup.playingLevel} setPlayingLevel={setup.setPlayingLevel}
                    playingStyle={setup.playingStyle} setPlayingStyle={setup.setPlayingStyle}
                    dominantHand={setup.dominantHand} setDominantHand={setup.setDominantHand}
                    favoriteShot={setup.favoriteShot} setFavoriteShot={setup.setFavoriteShot}
                    startedPlayingYear={setup.startedPlayingYear} setStartedPlayingYear={setup.setStartedPlayingYear}
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
                    className="w-full min-h-[52px] bg-primary hover:bg-primary text-primary-foreground font-bold px-5 py-3.5 rounded-xl shadow-lg shadow-primary/25 transition-all text-base sm:text-lg flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {setup.loading ? (
                      <>
                        <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black/80 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        {setup.isEditing ? "Save & Launch Profile" : "Save & Enter Club"}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={setup.loading}
                    onClick={(e) => {
                      e.preventDefault();
                      setup.handleSubmit(undefined, nextTabId as string);
                    }}
                    className="w-full min-h-[52px] bg-primary hover:bg-primary text-primary-foreground font-bold px-5 py-3.5 rounded-xl shadow-lg shadow-primary/25 transition-all text-base sm:text-lg flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {setup.loading ? (
                      <>
                        <div className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black/80 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save & Next: {nextTabObj?.label} <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                )}

                {setup.isEditing && (
                    <button
                      type="button"
                      onClick={(e) => setup.handleSubmit(e as any)}
                      disabled={setup.loading}
                      className="min-h-[52px] px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-200 font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed text-xs sm:text-sm"
                    >
                      Save & Return to Profile
                    </button>
                )}
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
