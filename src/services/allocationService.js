import { collection, doc, addDoc, getDocs, query, where, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const ALLOCATIONS_COLLECTION = 'allocations';

// Cache for holidays to avoid multiple fetches
let nationalHolidaysCache = new Set();
let holidaysFetched = false;

/**
 * Fetches national holidays from BrasilAPI for current and next year
 */
export const fetchNationalHolidays = async () => {
  if (holidaysFetched) return;
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  try {
    const [res1, res2] = await Promise.all([
      fetch(`https://brasilapi.com.br/api/feriados/v1/${currentYear}`),
      fetch(`https://brasilapi.com.br/api/feriados/v1/${nextYear}`)
    ]);
    
    if (res1.ok) {
      const data1 = await res1.json();
      data1.forEach(h => nationalHolidaysCache.add(h.date));
    }
    if (res2.ok) {
      const data2 = await res2.json();
      data2.forEach(h => nationalHolidaysCache.add(h.date));
    }
    holidaysFetched = true;
  } catch (error) {
    console.error("Erro ao carregar feriados nacionais:", error);
  }
};

/**
 * Checks if a given Date is a working day (Mon-Fri and not a holiday)
 * @param {Date} dateObj 
 * @returns {boolean}
 */
export const isWorkingDay = (dateObj) => {
  const day = dateObj.getDay();
  if (day === 0 || day === 6) return false; // Sunday or Saturday

  const dateStr = dateObj.toISOString().split('T')[0];
  if (nationalHolidaysCache.has(dateStr)) return false;

  return true;
};

/**
 * Gets the next working day starting from a given date
 * @param {Date} startDate 
 * @returns {Date}
 */
export const getNextWorkingDay = (startDate) => {
  let nextDate = new Date(startDate);
  nextDate.setDate(nextDate.getDate() + 1);
  while (!isWorkingDay(nextDate)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return nextDate;
};

/**
 * Subscribes to all allocations for a specific squad/project or globally
 * (For now, we fetch globally or filter by userIds if needed, but since it's admin view, global is fine or we can filter)
 */
export const subscribeToAllocations = (callback) => {
  const q = query(collection(db, ALLOCATIONS_COLLECTION));
  return onSnapshot(q, (snapshot) => {
    const allocations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(allocations);
  });
};

/**
 * Perform the "transbordo" allocation algorithm and save to Firestore
 * @param {string} activityId 
 * @param {string} activityType (ticket, estimation, specification)
 * @param {number} totalHours 
 * @param {string} userId 
 * @param {string} startDateStr (YYYY-MM-DD)
 * @param {Array} currentAllocations (all allocations from state)
 * @param {string} assignerName 
 */
export const allocateActivity = async (activityId, activityType, totalHours, userId, startDateStr, currentAllocations, forceNonWorkingDay = false, assignerName = 'Sistema') => {
  await fetchNationalHolidays();

  const batch = writeBatch(db);
  let remainingHours = Math.ceil(parseFloat(totalHours));
  if (isNaN(remainingHours) || remainingHours <= 0) remainingHours = 8; // fallback to 1 day if invalid

  let currentDate = new Date(`${startDateStr}T12:00:00Z`); // use midday to avoid timezone shifts
  
  // Advance if start date is not a working day and we are not forcing HE
  if (!forceNonWorkingDay) {
    while (!isWorkingDay(currentDate)) {
      currentDate = getNextWorkingDay(currentDate);
    }
  }

  // Group current allocations by date for this user
  const userAllocations = currentAllocations.filter(a => a.userId === userId);
  const hoursPerDay = {};
  userAllocations.forEach(a => {
    hoursPerDay[a.date] = (hoursPerDay[a.date] || 0) + parseFloat(a.hours || 0);
  });

  const newAllocations = [];

  while (remainingHours > 0) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const occupiedToday = hoursPerDay[dateStr] || 0;
    const availableToday = Math.max(0, 8 - occupiedToday);

    if (availableToday > 0) {
      const hoursToAllocate = Math.min(remainingHours, availableToday);
      
      newAllocations.push({
        activityId,
        activityType,
        userId,
        date: dateStr,
        hours: hoursToAllocate,
        assignerName,
        createdAt: new Date()
      });

      remainingHours -= hoursToAllocate;
      hoursPerDay[dateStr] = occupiedToday + hoursToAllocate;
    }

    if (remainingHours > 0) {
      currentDate = getNextWorkingDay(currentDate);
    }
  }

  // Save new allocations
  for (const alloc of newAllocations) {
    const docRef = doc(collection(db, ALLOCATIONS_COLLECTION));
    batch.set(docRef, alloc);
  }

  await batch.commit();
  return newAllocations;
};

/**
 * Removes all allocations for a given activity
 * @param {string} activityId 
 */
export const unallocateActivity = async (activityId) => {
  const q = query(collection(db, ALLOCATIONS_COLLECTION), where('activityId', '==', activityId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });
  
  await batch.commit();
};

/**
 * Adjusts hours of an allocation. If positive, adds HE and subtracts from future. 
 * If negative, subtracts HE and pushes to next working day.
 */
export const adjustAllocationHours = async (allocationId, activityId, amount, allAllocations) => {
  const q = query(collection(db, ALLOCATIONS_COLLECTION), where('activityId', '==', activityId));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return;

  let allocations = [];
  snapshot.forEach(docSnap => {
    allocations.push({ id: docSnap.id, ref: docSnap.ref, ...docSnap.data() });
  });

  allocations.sort((a, b) => new Date(a.date) - new Date(b.date));

  const targetIndex = allocations.findIndex(a => a.id === allocationId);
  if (targetIndex === -1) return;

  const batch = writeBatch(db);
  const targetAlloc = allocations[targetIndex];
  
  if (amount > 0) {
    batch.update(targetAlloc.ref, { hours: targetAlloc.hours + amount });
    let hoursToSubtract = amount;
    for (let i = targetIndex + 1; i < allocations.length; i++) {
      if (hoursToSubtract <= 0) break;
      const futureAlloc = allocations[i];
      if (futureAlloc.hours <= hoursToSubtract) {
        hoursToSubtract -= futureAlloc.hours;
        batch.delete(futureAlloc.ref);
      } else {
        batch.update(futureAlloc.ref, { hours: futureAlloc.hours - hoursToSubtract });
        hoursToSubtract = 0;
      }
    }
    await batch.commit();
  } else if (amount < 0) {
    const removeAmount = Math.abs(amount);
    if (targetAlloc.hours <= removeAmount) {
      batch.delete(targetAlloc.ref);
    } else {
      batch.update(targetAlloc.ref, { hours: targetAlloc.hours - removeAmount });
    }
    await batch.commit();

    let nextDate = new Date(`${targetAlloc.date}T12:00:00Z`);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    await allocateActivity(targetAlloc.activityId, targetAlloc.activityType, removeAmount, targetAlloc.userId, nextDateStr, allAllocations);
  }
};
