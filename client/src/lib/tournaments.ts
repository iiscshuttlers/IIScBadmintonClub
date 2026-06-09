export async function getTournaments() {
  const invictaTournament = {
    id: "invicta-2026",
    slug: "invicta-2026",
    name: "INVICTA Open Tournament",
    subtitle: "Registrations are Closed !!",
    description:
      "Get ready for the badminton showdown! The INVICTA Open Tournament is tentatively scheduled from 1st June to 21st June. Registrations are through forms (right now it is closed - https://forms.cloud.microsoft/r/c82F9mgTv5). Open to all IISc members.",
    startDate: "2026-06-01",
    status: "upcoming",
    type: "open",
  };

  return [invictaTournament];
}
