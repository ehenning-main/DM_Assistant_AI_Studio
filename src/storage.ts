import { collection, doc, query, where, getDocs, setDoc, deleteDoc, orderBy, serverTimestamp } from "firebase/firestore";
import { db, isRealFirebase, handleFirestoreError, OperationType } from "./firebase";
import { Session, Campaign } from "./types";

const LOCAL_STORAGE_KEY = "dnd_dm_assistant_sessions_v1";
const CAMPAIGN_LOCAL_STORAGE_KEY = "dnd_dm_assistant_campaigns_v1";

// Fetches all campaigns associated with the DM
export async function fetchAllCampaigns(userId: string): Promise<Campaign[]> {
  if (isRealFirebase && db && userId !== "local_guest_dm") {
    const path = "campaigns";
    try {
      const q = query(
        collection(db, path),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(q);
      const list: Campaign[] = [];
      snapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        list.push({
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
        } as Campaign);
      });
      return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  } else {
    // Local storage fallback
    const raw = localStorage.getItem(CAMPAIGN_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    try {
      const data = JSON.parse(raw) as Campaign[];
      return data
        .filter((c) => c.userId === userId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      return [];
    }
  }
}

// Persists a newly created campaign
export async function createNewCampaign(campaign: Campaign): Promise<void> {
  const timestampISO = new Date().toISOString();
  if (isRealFirebase && db && campaign.userId !== "local_guest_dm") {
    const path = `campaigns/${campaign.id}`;
    try {
      const docRef = doc(db, "campaigns", campaign.id);
      await setDoc(docRef, {
        ...campaign,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    const list = await fetchAllCampaigns(campaign.userId);
    const newCamp = {
      ...campaign,
      createdAt: timestampISO,
      updatedAt: timestampISO,
    };
    list.unshift(newCamp);
    localStorage.setItem(CAMPAIGN_LOCAL_STORAGE_KEY, JSON.stringify(list));
  }
}

// Saves changes to an existing campaign
export async function updateExistingCampaign(campaign: Campaign): Promise<void> {
  const timestampISO = new Date().toISOString();
  if (isRealFirebase && db && campaign.userId !== "local_guest_dm") {
    const path = `campaigns/${campaign.id}`;
    try {
      const docRef = doc(db, "campaigns", campaign.id);
      const { createdAt, ...updatedFields } = campaign;
      await setDoc(docRef, {
        ...updatedFields,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    const list = await fetchAllCampaigns(campaign.userId);
    const index = list.findIndex((c) => c.id === campaign.id);
    if (index !== -1) {
      list[index] = {
        ...campaign,
        updatedAt: timestampISO,
      };
    } else {
      list.push({
        ...campaign,
        createdAt: timestampISO,
        updatedAt: timestampISO,
      });
    }
    localStorage.setItem(CAMPAIGN_LOCAL_STORAGE_KEY, JSON.stringify(list));
  }
}

// Deletes a campaign item and cascadingly removes all of its associated sessions
export async function removeCampaign(campaignId: string, userId: string): Promise<void> {
  if (isRealFirebase && db && userId !== "local_guest_dm") {
    const path = `campaigns/${campaignId}`;
    try {
      const docRef = doc(db, "campaigns", campaignId);
      await deleteDoc(docRef);

      // Cascading deletion of sessions belonging to the campaign
      const q = query(
        collection(db, "sessions"),
        where("campaignId", "==", campaignId)
      );
      const snapshot = await getDocs(q);
      const deletePromises: Promise<void>[] = [];
      snapshot.forEach((snapDoc) => {
        deletePromises.push(deleteDoc(snapDoc.ref));
      });
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  } else {
    const list = await fetchAllCampaigns(userId);
    const filtered = list.filter((c) => c.id !== campaignId);
    localStorage.setItem(CAMPAIGN_LOCAL_STORAGE_KEY, JSON.stringify(filtered));

    // Delete associated sessions from localStorage
    const rawSessions = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (rawSessions) {
      try {
        const sessions = JSON.parse(rawSessions) as Session[];
        const filteredSessions = sessions.filter((s) => s.campaignId !== campaignId);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filteredSessions));
      } catch {
        // ignore parsing errors
      }
    }
  }
}

// Fetches all campaign sessions associated with the DM
export async function fetchAllSessions(userId: string): Promise<Session[]> {
  if (isRealFirebase && db && userId !== "local_guest_dm") {
    const path = "sessions";
    try {
      const q = query(
        collection(db, path),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(q);
      const list: Session[] = [];
      snapshot.forEach((snapshotDoc) => {
        const data = snapshotDoc.data();
        list.push({
          ...data,
          // Convert Firestore timestamps gracefully or handle string timestamps
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
        } as Session);
      });
      return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  } else {
    // Local storage fallback
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    try {
      const data = JSON.parse(raw) as Session[];
      // Filter by DM userId
      return data
        .filter((s) => s.userId === userId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      return [];
    }
  }
}

// Persists a newly created campaign session log
export async function createNewSession(session: Session): Promise<void> {
  const timestampISO = new Date().toISOString();
  if (isRealFirebase && db && session.userId !== "local_guest_dm") {
    const path = `sessions/${session.id}`;
    try {
      const docRef = doc(db, "sessions", session.id);
      await setDoc(docRef, {
        ...session,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  } else {
    // Local storage persistence
    const list = await fetchAllSessions(session.userId);
    const newSession = {
      ...session,
      createdAt: timestampISO,
      updatedAt: timestampISO,
    };
    list.unshift(newSession);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  }
}

// Saves changes to an existing campaign session
export async function updateExistingSession(session: Session): Promise<void> {
  const timestampISO = new Date().toISOString();
  if (isRealFirebase && db && session.userId !== "local_guest_dm") {
    const path = `sessions/${session.id}`;
    try {
      const docRef = doc(db, "sessions", session.id);
      // Ensure we preserve the original createdAt of type timestamp by omitting it from the string-based payload
      const { createdAt, ...updatedFields } = session;
      await setDoc(docRef, {
        ...updatedFields,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    // Local storage update
    const list = await fetchAllSessions(session.userId);
    const index = list.findIndex((s) => s.id === session.id);
    if (index !== -1) {
      list[index] = {
        ...session,
        updatedAt: timestampISO,
      };
    } else {
      list.push({
        ...session,
        createdAt: timestampISO,
        updatedAt: timestampISO,
      });
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  }
}

// Deletes a campaign session item
export async function removeSession(sessionId: string, userId: string): Promise<void> {
  if (isRealFirebase && db && userId !== "local_guest_dm") {
    const path = `sessions/${sessionId}`;
    try {
      const docRef = doc(db, "sessions", sessionId);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  } else {
    // Local storage deletion
    const list = await fetchAllSessions(userId);
    const filtered = list.filter((s) => s.id !== sessionId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  }
}
