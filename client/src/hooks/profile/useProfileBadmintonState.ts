import { useState } from "react";

export function useProfileBadmintonState() {
  const [playingLevel, setPlayingLevel] = useState("Intermediate");
  const [playingStyle, setPlayingStyle] = useState("");
  const [dominantHand, setDominantHand] = useState("Right-handed");
  const [favoriteShot, setFavoriteShot] = useState("");
  const [yearsPlaying, setYearsPlaying] = useState("");
  const [coach, setCoach] = useState("");
  const [favoriteIdol, setFavoriteIdol] = useState("");
  const [favoriteFormat, setFavoriteFormat] = useState("");

  return {
    playingLevel, setPlayingLevel, playingStyle, setPlayingStyle, dominantHand, setDominantHand,
    favoriteShot, setFavoriteShot, yearsPlaying, setYearsPlaying, coach, setCoach,
    favoriteIdol, setFavoriteIdol, favoriteFormat, setFavoriteFormat,
  };
}
