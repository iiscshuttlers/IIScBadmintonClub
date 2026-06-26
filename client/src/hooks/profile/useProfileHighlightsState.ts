import { useState } from "react";

export function useProfileHighlightsState() {
  const [bio, setBio] = useState("");
  const [quote, setQuote] = useState("");
  const [achievementsRaw, setAchievementsRaw] = useState("");
  const [tournamentsRaw, setTournamentsRaw] = useState("");
  const [tourName, setTourName] = useState("");
  const [tourYear, setTourYear] = useState("");
  const [achMedal, setAchMedal] = useState("Gold");
  const [achCustomMedal, setAchCustomMedal] = useState("");
  const [achTournament, setAchTournament] = useState("");
  const [achCategory, setAchCategory] = useState("Men's");
  const [achEventType, setAchEventType] = useState("Singles");
  const [careerHighlights, setCareerHighlights] = useState<{ year: string; title: string; description: string }[]>([]);

  return {
    bio, setBio, quote, setQuote, achievementsRaw, setAchievementsRaw, tournamentsRaw, setTournamentsRaw,
    tourName, setTourName, tourYear, setTourYear, achMedal, setAchMedal, achCustomMedal, setAchCustomMedal,
    achTournament, setAchTournament, achCategory, setAchCategory, achEventType, setAchEventType,
    careerHighlights, setCareerHighlights,
  };
}
