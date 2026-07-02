export interface SiteConfig {
  stats: {
    members: string;
    tournaments: string;
    trophies: string;
  };
  contact: {
    email: string;
    instagram: string;
    location: string;
  };
  elo?: {
    kNewbie: number;
    kExperienced: number;
    tournamentMultiplier: number;
  };
}

export interface SiteHoliday {
  id: string;
  date: string;
  name: string;
  type: string;
}

export interface SiteAnnouncement {
  id: string;
  title: string;
  content: string;
  date: string;
  priority: "low" | "medium" | "high";
}

export interface SiteGalleryItem {
  id: string;
  url: string;
  title: string;
  type: "image" | "video";
}
