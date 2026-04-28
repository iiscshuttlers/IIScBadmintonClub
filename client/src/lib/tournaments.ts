import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export async function getTournaments() {
  const snapshot = await getDocs(collection(db, 'tournaments'));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}