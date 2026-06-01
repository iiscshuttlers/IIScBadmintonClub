import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export async function getTournaments() {
  let fetchedTournaments: any[] = [];
  try {
    const snapshot = await getDocs(collection(db, 'tournaments'));
    fetchedTournaments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.warn("Failed to fetch tournaments from Firebase:", error);
  }

  const invictaTournament = {
    id: 'invicta-2026',
    slug: 'invicta-2026',
    name: 'INVICTA Open Tournament',
    subtitle: 'Registrations are Closed !!',
    description: 'Get ready for the badminton showdown! The INVICTA Open Tournament is tentatively scheduled from 1st June to 21st June. Registrations will open soon. Open to all IISc members.',
    startDate: '2026-06-01',
    status: 'upcoming',
    type: 'open',
  };

  return [invictaTournament, ...fetchedTournaments];
}