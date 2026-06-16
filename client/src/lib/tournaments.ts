export async function getTournaments() {
  const invictaTournament = {
    id: "invicta-2026",
    slug: "invicta-2026",
    name: "INVICTA Open Tournament",
    subtitle: "Postponed",
    description:
      "The INVICTA Open Tournament has been postponed. Please check back later for new dates and updates. Open to all IISc members.",
    startDate: "",
    status: "postponed",
    type: "open",
  };

  return [invictaTournament];
}
