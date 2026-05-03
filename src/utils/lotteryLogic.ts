import { DOUBLE_SETS, UGLY_NUMBERS, BEAUTIFUL_NUMBERS, FORBIDDEN_GROUPS, EXTREMELY_UGLY_NUMBERS, EXTREMELY_BEAUTIFUL_NUMBERS, getPairId } from '../constants';
import { Seller, DistributionResult, LotterySet, DistributionReport, Shortage } from '../types';

export function getNeutralNumbers(): string[] {
  const allNumbers = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
  return allNumbers.filter(n => !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n));
}

export function getDecade(num: string): number {
  return Math.floor(parseInt(num) / 10);
}

export function isForbidden(numbers: string[], setId?: string): boolean {
  // Rule: Forbidden Groups
  for (const group of FORBIDDEN_GROUPS) {
    const intersection = group.filter(n => numbers.includes(n));
    if (intersection.length > 1) return true;
  }

  // Rule: Special Sets (00, 04, 05 cannot have 45, 85)
  if (setId && ['00', '04', '05'].includes(setId)) {
    if (numbers.includes('45') || numbers.includes('85')) return true;
  }

  return false;
}

/**
 * Checks if a number violates the "Max 2 per ending" or "Balanced Decades" rules.
 * @param num The number to check
 * @param existing The already selected numbers for the seller
 * @param targetTotal The total numbers the seller will receive
 * @returns true if it violates the rules
 */
export function violatesDistributionRules(num: string, existing: string[], targetTotal: number): boolean {
  const decade = getDecade(num);
  const ending = num.slice(-1);

  // Rule: No duplicate tens (hàng) - strict for all sellers
  // "không được trùng hàng"
  const maxDecade = Math.max(1, Math.ceil(targetTotal / 10));
  const decadeCount = existing.filter(n => getDecade(n) === decade).length;
  if (decadeCount >= maxDecade) return true;

  // Rule: No duplicate endings (đuôi) - strict for small sellers
  // Large sellers can have dup endings but NOT dup tens
  // "Có thể trùng đuôi nhưng ko trùng hàng"
  const isLargeSeller = targetTotal > 15;
  if (!isLargeSeller) {
    // Small sellers: no duplicate endings at all
    const endingCount = existing.filter(n => n.slice(-1) === ending).length;
    if (endingCount >= 2) return true;
  } else {
    // Large sellers: allow more ending duplicates but still limit
    const maxEnding = Math.max(2, Math.ceil(targetTotal / 10));
    const endingCount = existing.filter(n => n.slice(-1) === ending).length;
    if (endingCount >= maxEnding) return true;
  }

  return false;
}

export function hasDuplicateEnding(numbers: string[], newNumber: string): boolean {
  const ending = newNumber.slice(-1);
  return numbers.some(n => n.slice(-1) === ending);
}

export function distributeTickets(
  date: string,
  sellers: Seller[],
  mainStationPool: Record<string, number>,
  subStations: { id: string, name: string, tickets: Record<string, number> }[],
  lotterySets: LotterySet[],
  doubleSets: Record<string, string>,
  history: DistributionResult[][] = []
): DistributionReport {
  const results: DistributionResult[] = [];
  const shortages: Shortage[] = [];
  const neutralNumbers = getNeutralNumbers();

  const getPairIdLocal = (id: string): string | undefined => {
    if (doubleSets[id]) return doubleSets[id];
    return Object.keys(doubleSets).find(key => doubleSets[key] === id);
  };

  // Clone pools to manage inventory
  const currentMainPool = { ...mainStationPool };
  const currentSubPools: Record<string, Record<string, number>> = {};
  subStations.forEach(s => {
    currentSubPools[s.id] = { ...s.tickets };
  });

  // Calculate global pool ratios from input quantities
  // This ensures every seller gets the SAME proportional split across all stations
  const totalMainPoolQty = Object.values(mainStationPool).reduce((a, b) => a + b, 0);
  const totalSubPoolQtys: Record<string, number> = {};
  const activeSubStations: { id: string, name: string }[] = [];
  subStations.forEach(s => {
    const subTotal = Object.values(s.tickets).reduce((a, b) => a + b, 0);
    totalSubPoolQtys[s.id] = subTotal;
    if (subTotal > 0) activeSubStations.push({ id: s.id, name: s.name });
  });
  const totalAllPoolQty = totalMainPoolQty + Object.values(totalSubPoolQtys).reduce((a, b) => a + b, 0);
  const globalMainRatio = totalAllPoolQty > 0 ? totalMainPoolQty / totalAllPoolQty : 0.7;
  const globalSubRatioTotal = Object.values(totalSubPoolQtys).reduce((a, b) => a + b, 0);

  // 1. Determine Base Set Index from Date
  const day = new Date(date).getDate();
  const baseSetIndex = (day - 1) % lotterySets.length;

  // Rule 12: Global ugly number weekly tracking
  // Count how many times each ugly number appeared across ALL sellers this week
  const allUglyNumbers = [...UGLY_NUMBERS]; // 00,04,05,45,85,20,40,50,60,80,90
  const weeklyUglyGlobal: Record<string, number> = {};
  allUglyNumbers.forEach(num => {
    weeklyUglyGlobal[num] = history
      .slice(0, 7)
      .flatMap(dayResults => dayResults)
      .flatMap(r => [...r.mainStationNumbers, ...r.subStationResults.flatMap(sr => sr.numbers)])
      .filter(n => n === num).length;
  });

  // Track ugly numbers assigned TODAY across all sellers (for global enforcement)
  const todayUglyAssignments: Record<string, string[]> = {}; // uglyNum -> [sellerId]
  allUglyNumbers.forEach(num => { todayUglyAssignments[num] = []; });

  // Track which seller got which ugly number yesterday (for non-consecutive rule)
  const yesterdayUglyPerSeller: Record<string, string[]> = {}; // sellerId -> [uglyNums]
  if (history.length > 0) {
    history[0].forEach(r => {
      const allNums = [...r.mainStationNumbers, ...r.subStationResults.flatMap(sr => sr.numbers)];
      yesterdayUglyPerSeller[r.sellerId] = allNums.filter(n => UGLY_NUMBERS.includes(n));
    });
  }

  const enabledSellers = sellers
    .map((s, index) => ({ seller: s, originalIndex: index }))
    .filter(item => item.seller.isEnabled)
    .sort((a, b) => b.seller.targetTotalTickets - a.seller.targetTotalTickets);

  enabledSellers.forEach(({ seller, originalIndex }) => {
    const sIdx = originalIndex;

    // Get seller history for "not in last 2-3 days" rule
    const sellerHistory = history
      .slice(0, 3) // Check last 3 days
      .flatMap(dayResults => dayResults.filter(r => r.sellerId === seller.id))
      .flatMap(r => [
        ...r.mainStationNumbers,
        ...r.subStationResults.flatMap(sr => sr.numbers)
      ]);

    // Rule: Special numbers max 2 times per week
    const weeklyHistory = history
      .slice(0, 7) // Check last 7 days
      .flatMap(dayResults => dayResults.filter(r => r.sellerId === seller.id))
      .flatMap(r => [
        ...r.mainStationNumbers,
        ...r.subStationResults.flatMap(sr => sr.numbers)
      ]);

    const specialNumbersCounts: Record<string, number> = {};
    ['00', '04', '05', '45', '85'].forEach(num => {
      specialNumbersCounts[num] = weeklyHistory.filter(n => n === num).length;
    });

    const isNumberForbidden = (nums: string[], setId?: string) => {
      if (isForbidden(nums, setId)) return true;
      const lastNum = nums[nums.length - 1];
      if (['00', '04', '05', '45', '85'].includes(lastNum)) {
        // Count how many times it appeared this week + current assignment
        const currentCount = nums.filter(n => n === lastNum).length - 1; // -1 because it's in nums
        if ((specialNumbersCounts[lastNum] || 0) + currentCount >= 2) return true;
      }
      return false;
    };

    // Determine starting set
    let startSetIndex = baseSetIndex;
    if (seller.fixedSetId) {
      const fixedIdx = lotterySets.findIndex(s => s.id === seller.fixedSetId);
      if (fixedIdx !== -1) startSetIndex = fixedIdx;
    } else if (seller.isAutoMode) {
      startSetIndex = (baseSetIndex + sIdx) % lotterySets.length;
    } else if (seller.manualSetId) {
      const manualIdx = lotterySets.findIndex(s => s.id === seller.manualSetId);
      if (manualIdx !== -1) startSetIndex = manualIdx;
    }

    // Calculate sheets per number
    let sheetsPerNumber = 16;
    if (seller.sheetsOption === '32') sheetsPerNumber = 32;
    else if (seller.sheetsOption === 'custom') sheetsPerNumber = seller.customSheets || 16;

    // 1. Process Custom Preferences First
    let mainNumbers: string[] = [];
    let mainStationQuantities: Record<string, number> = {};
    let subStationResults: { id: string, name: string, numbers: string[], quantities: Record<string, number> }[] = [];

    // Initialize subStationResults with correct names
    subStations.forEach(s => {
      subStationResults.push({ id: s.id, name: s.name, numbers: [], quantities: {} });
    });

    let currentTargetTotal = seller.targetTotalTickets;

    const currentDayOfWeek = new Date(date).getDay();

    if (seller.customPreferences && seller.customPreferences.length > 0) {
      seller.customPreferences.forEach(pref => {
        // Filter by day of week if specified
        if (pref.dayOfWeek !== undefined && pref.dayOfWeek !== currentDayOfWeek) return;

        const num = pref.number;
        const qty = pref.quantity;
        const stationId = pref.stationId;

        if (stationId === 'main') {
          if (currentMainPool[num] >= qty) {
            mainNumbers.push(num);
            mainStationQuantities[num] = qty;
            currentMainPool[num] -= qty;
            currentTargetTotal -= qty;
          } else {
            shortages.push({
              sellerId: seller.id,
              sellerName: seller.name,
              station: 'main',
              needed: qty,
              available: currentMainPool[num] || 0,
              missingNumber: num
            });
          }
        } else if (stationId && currentSubPools[stationId]) {
          if (currentSubPools[stationId][num] >= qty) {
            const subRes = subStationResults.find(r => r.id === stationId);
            if (subRes) {
              subRes.numbers.push(num);
              subRes.quantities[num] = qty;
              currentSubPools[stationId][num] -= qty;
              currentTargetTotal -= qty;
            }
          } else {
            shortages.push({
              sellerId: seller.id,
              sellerName: seller.name,
              station: stationId,
              needed: qty,
              available: currentSubPools[stationId][num] || 0,
              missingNumber: num
            });
          }
        } else {
          // Automatic selection for preference
          if (currentMainPool[num] >= qty) {
            mainNumbers.push(num);
            mainStationQuantities[num] = qty;
            currentMainPool[num] -= qty;
            currentTargetTotal -= qty;
          } else {
            let foundInSub = false;
            for (const subId of Object.keys(currentSubPools)) {
              if (currentSubPools[subId][num] >= qty) {
                const subRes = subStationResults.find(r => r.id === subId);
                if (subRes) {
                  subRes.numbers.push(num);
                  subRes.quantities[num] = qty;
                  currentSubPools[subId][num] -= qty;
                  currentTargetTotal -= qty;
                  foundInSub = true;
                  break;
                }
              }
            }
            if (!foundInSub) {
              shortages.push({
                sellerId: seller.id,
                sellerName: seller.name,
                station: 'ưu tiên',
                needed: qty,
                available: 0,
                missingNumber: num
              });
            }
          }
        }
      });
    }

    // 2. Calculate remaining numbers needed from sets
    let targetMainCount = 0;
    let targetSubCounts: Record<string, number> = {};

    const remainingNumbersNeeded = Math.max(0, Math.ceil(currentTargetTotal / sheetsPerNumber));

    if (seller.allocationMode === 'manual') {
      targetMainCount = Math.ceil((currentTargetTotal || 0) / sheetsPerNumber);
      Object.entries(seller.subStationRatios).forEach(([id, qty]) => {
        targetSubCounts[id] = Math.ceil(qty / sheetsPerNumber);
      });
    } else {
      // Use GLOBAL pool ratio so every seller gets the same proportional split
      // This ensures everyone has all sub-stations with equal percentage
      const effectiveMainRatio = totalAllPoolQty > 0 ? globalMainRatio : (seller.customRatio !== undefined ? seller.customRatio / 100 : 0.7);
      targetMainCount = seller.mainEnabled ? Math.round(remainingNumbersNeeded * effectiveMainRatio) : 0;

      const totalSubNeeded = remainingNumbersNeeded - targetMainCount;

      // Distribute to ALL active sub-stations proportionally based on input pool quantities
      if (activeSubStations.length > 0 && totalSubNeeded > 0) {
        let allocatedSub = 0;
        activeSubStations.forEach((sub, idx) => {
          if (idx === activeSubStations.length - 1) {
            // Last sub-station gets the remainder to avoid rounding issues
            targetSubCounts[sub.id] = Math.max(1, totalSubNeeded - allocatedSub);
          } else {
            // Proportional based on input pool size
            const subRatio = globalSubRatioTotal > 0 ? totalSubPoolQtys[sub.id] / globalSubRatioTotal : 1 / activeSubStations.length;
            const count = Math.max(1, Math.round(subRatio * totalSubNeeded));
            targetSubCounts[sub.id] = count;
            allocatedSub += count;
          }
        });
      }
    }

    const totalNeededFromSets = targetMainCount + Object.values(targetSubCounts).reduce((a, b) => a + b, 0);
    let initialNumbersFromSets: string[] = [];
    let currentSetOffset = 0;

    // Collect from sets while maintaining structure
    const startSet = lotterySets[startSetIndex];

    while (initialNumbersFromSets.length < totalNeededFromSets) {
      const setIdx = (startSetIndex + currentSetOffset) % lotterySets.length;
      const set = lotterySets[setIdx];
      const setIdsToTake = [set.id];
      if (seller.setType === 'double') {
        const pairId = getPairIdLocal(set.id);
        if (pairId) setIdsToTake.push(pairId);
      }

      setIdsToTake.forEach(id => {
        const s = lotterySets.find(ls => ls.id === id);
        if (s) {
          s.numbers.forEach(num => {
            if (initialNumbersFromSets.length < totalNeededFromSets && !initialNumbersFromSets.includes(num) && !mainNumbers.includes(num) && !subStationResults.some(r => r.numbers.includes(num))) {

              const isSmallSeller = seller.targetTotalTickets <= 160;
              const allCurrent = [...initialNumbersFromSets, ...mainNumbers, ...subStationResults.flatMap(r => r.numbers)];

              // Check for forbidden, history, or distribution rule violations
              const shouldReplace = sellerHistory.includes(num) ||
                isForbidden([...allCurrent, num], startSet.id) ||
                violatesDistributionRules(num, allCurrent, totalNeededFromSets);

              if (shouldReplace) {
                const availableMain = Object.keys(currentMainPool).filter(n => currentMainPool[n] >= sheetsPerNumber);
                const replacement = findReplacement(
                  num,
                  availableMain,
                  allCurrent,
                  neutralNumbers,
                  sellerHistory,
                  startSet.id,
                  true,
                  isSmallSeller,
                  totalNeededFromSets
                );
                if (replacement) initialNumbersFromSets.push(replacement);
                else initialNumbersFromSets.push(num); // Fallback if no replacement found
              } else {
                initialNumbersFromSets.push(num);
              }
            }
          });
        }
      });
      currentSetOffset++;
      if (currentSetOffset > lotterySets.length * 2) break;
    }

    // 3. Apply Decade Distribution Rules based on total count
    const totalAssignedCount = initialNumbersFromSets.length + mainNumbers.length + subStationResults.reduce((acc, r) => acc + r.numbers.length, 0);

    // Helper to add specific decades if missing
    const ensureDecades = (count0x: number, count9x: number) => {
      const current0x = [...initialNumbersFromSets, ...mainNumbers, ...subStationResults.flatMap(r => r.numbers)].filter(n => getDecade(n) === 0).length;
      const current9x = [...initialNumbersFromSets, ...mainNumbers, ...subStationResults.flatMap(r => r.numbers)].filter(n => getDecade(n) === 9).length;

      let needed0x = Math.max(0, count0x - current0x);
      let needed9x = Math.max(0, count9x - current9x);

      while ((needed0x > 0 || needed9x > 0) && initialNumbersFromSets.length > 0) {
        const replaceableIdx = initialNumbersFromSets.findIndex(n => getDecade(n) !== 0 && getDecade(n) !== 9);
        if (replaceableIdx === -1) break;

        if (needed0x > 0) {
          const available0x = Object.keys(currentMainPool).filter(n => currentMainPool[n] >= sheetsPerNumber && getDecade(n) === 0 && !initialNumbersFromSets.includes(n));
          if (available0x.length > 0) {
            initialNumbersFromSets[replaceableIdx] = available0x[0];
            needed0x--;
            continue;
          }
        }
        if (needed9x > 0) {
          const available9x = Object.keys(currentMainPool).filter(n => currentMainPool[n] >= sheetsPerNumber && getDecade(n) === 9 && !initialNumbersFromSets.includes(n));
          if (available9x.length > 0) {
            initialNumbersFromSets[replaceableIdx] = available9x[0];
            needed9x--;
            continue;
          }
        }
        break;
      }
    };

    if (totalAssignedCount >= 10 && totalAssignedCount <= 15) {
      ensureDecades(1, 0); // At least one 0x or 9x (logic simplified to at least one 0x for now, but could be either)
      // Actually user said "ít nhất một số hàng 0x hoặc 9x"
      const has0xOr9x = [...initialNumbersFromSets, ...mainNumbers, ...subStationResults.flatMap(r => r.numbers)].some(n => [0, 9].includes(getDecade(n)));
      if (!has0xOr9x) ensureDecades(1, 0);
    } else if (totalAssignedCount > 15 && totalAssignedCount <= 20) {
      ensureDecades(1, 1); // Add one 0x and one 9x
    } else if (totalAssignedCount > 20) {
      // Cap at 2 to avoid over-assigning 0x/9x numbers
      const setsCount = Math.min(2, Math.floor(totalAssignedCount / 10));
      ensureDecades(setsCount, setsCount);
    }

    // Ensure all decades for 15+ numbers
    if (totalAssignedCount >= 15) {
      const presentDecades = new Set([...initialNumbersFromSets, ...mainNumbers, ...subStationResults.flatMap(r => r.numbers)].map(getDecade));
      for (let d = 0; d <= 9; d++) {
        if (!presentDecades.has(d)) {
          const replaceableIdx = initialNumbersFromSets.findIndex(n => {
            const decade = getDecade(n);
            const decadeCount = initialNumbersFromSets.filter(num => getDecade(num) === decade).length;
            return decadeCount > 1;
          });
          const availableMain = Object.keys(currentMainPool).filter(n => currentMainPool[n] >= sheetsPerNumber && getDecade(n) === d);
          if (replaceableIdx !== -1 && availableMain.length > 0) {
            initialNumbersFromSets[replaceableIdx] = availableMain[0];
            presentDecades.add(d);
          }
        }
      }
    }

    // 4. Specific Set Logic (02-03, 08-09)
    if (['02', '03'].includes(startSet.id)) {
      // Prioritize adding 85 or 45
      const badNums = ['85', '45'].filter(n => currentMainPool[n] >= sheetsPerNumber && !initialNumbersFromSets.includes(n));
      if (badNums.length > 0) {
        const replaceableIdx = initialNumbersFromSets.findIndex(n => !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n));
        if (replaceableIdx !== -1) initialNumbersFromSets[replaceableIdx] = badNums[0];
      }
    }
    if (['08', '09'].includes(startSet.id)) {
      // Prioritize adding 04 or 05
      const badNums = ['04', '05'].filter(n => currentMainPool[n] >= sheetsPerNumber && !initialNumbersFromSets.includes(n));
      if (badNums.length > 0) {
        const replaceableIdx = initialNumbersFromSets.findIndex(n => !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n));
        if (replaceableIdx !== -1) initialNumbersFromSets[replaceableIdx] = badNums[0];
      }
    }

    // 5. Distribute initialNumbersFromSets to Main and Sub stations
    // Rule: Cannot withdraw from main: beautiful numbers, 0x, x0, x8 ending, x9 ending, 99
    const canWithdrawFromMain = (n: string) => {
      const val = parseInt(n);
      const decade = getDecade(n);
      const ending = n.slice(-1);
      // Cannot withdraw beautiful numbers
      if (BEAUTIFUL_NUMBERS.includes(n)) return false;
      // Cannot withdraw ugly numbers (phải giữ + phải xả)
      if (UGLY_NUMBERS.includes(n)) return false;
      // Cannot withdraw 0x numbers
      if (decade === 0) return false;
      // Cannot withdraw x0 numbers
      if (ending === '0') return false;
      // Cannot withdraw x8 or x9 endings
      if (ending === '8' || ending === '9') return false;
      // Cannot withdraw 99
      if (n === '99') return false;
      // Cannot withdraw 63
      if (n === '63') return false;
      // 9x can be withdrawn but sparingly - allow but deprioritize
      return true;
    };

    // Determine which indices to send to sub stations
    const replaceableIndices: number[] = [];
    initialNumbersFromSets.forEach((n, i) => {
      if (canWithdrawFromMain(n)) replaceableIndices.push(i);
    });

    let indicesToReplace: Record<number, string> = {};
    const availableToReplace = [...replaceableIndices];

    Object.entries(targetSubCounts).forEach(([subId, count]) => {
      let allocated = 0;
      while (allocated < count && availableToReplace.length > 0) {
        const randIdx = Math.floor(Math.random() * availableToReplace.length);
        const index = availableToReplace.splice(randIdx, 1)[0];
        indicesToReplace[index] = subId;
        allocated++;
      }
    });

    // Helper: find sub replacement with proper priority
    // Priority: same number > same tens digit (skip ±1,±2 from history) > nearby
    const findSubReplacement = (
      targetNum: string,
      availableSub: string[],
      allAssigned: string[],
      recentHistory: string[]
    ): string | null => {
      const targetDecade = getDecade(targetNum);
      const targetVal = parseInt(targetNum);

      // Filter out already assigned, forbidden, and decade/ending violations
      const safe = availableSub.filter(n =>
        !allAssigned.includes(n) &&
        !isNumberForbidden([...allAssigned, n], startSet.id) &&
        !violatesDistributionRules(n, allAssigned, totalNeededFromSets)
      );
      if (safe.length === 0) return null;

      // Priority 1: Exact same number
      if (safe.includes(targetNum)) return targetNum;

      // Priority 2: Same tens digit, but skip numbers ±1 and ±2 from target
      // e.g. 21 -> can use 23-29, NOT 20 or 22
      const sameDecade = safe.filter(n => {
        const d = getDecade(n);
        const v = parseInt(n);
        const diff = Math.abs(v - targetVal);
        // Same decade, skip ±1 and ±2 (too close / just sold)
        return d === targetDecade && diff >= 3;
      });
      // Also check not in recent history
      const sameDecadeNoHistory = sameDecade.filter(n => !recentHistory.includes(n));
      if (sameDecadeNoHistory.length > 0) return sameDecadeNoHistory[0];
      if (sameDecade.length > 0) return sameDecade[0];

      // Priority 3: Any safe number, prefer not in history
      const noHistory = safe.filter(n => !recentHistory.includes(n));
      if (noHistory.length > 0) return noHistory[0];
      return safe[0];
    };

    initialNumbersFromSets.forEach((num, idx) => {
      const subId = indicesToReplace[idx];
      if (subId) {
        const subPool = currentSubPools[subId] || {};
        const subResult = subStationResults.find(r => r.id === subId)!;
        const availableSub = Object.keys(subPool).filter(n => subPool[n] >= sheetsPerNumber);

        const currentAssigned = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers)];

        // Use proper replacement priority
        const replacement = findSubReplacement(num, availableSub, currentAssigned, sellerHistory);

        if (replacement) {
          subResult.numbers.push(replacement);
          subResult.quantities[replacement] = sheetsPerNumber;
          subPool[replacement] -= sheetsPerNumber;
          // Return withdrawn main number back to pool
          // (the number was "removed" from main set, goes back to kho)
        } else {
          // Fallback: keep it in Main if sub has nothing
          const futureNumbers = initialNumbersFromSets.slice(idx + 1);
          const allCurrent = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers), ...futureNumbers];

          if (currentMainPool[num] >= sheetsPerNumber && !allCurrent.includes(num)) {
            mainNumbers.push(num);
            mainStationQuantities[num] = sheetsPerNumber;
            currentMainPool[num] -= sheetsPerNumber;
          } else {
            const availableMain = Object.keys(currentMainPool).filter(n => currentMainPool[n] >= sheetsPerNumber);
            const isSmallSeller = seller.targetTotalTickets <= 160;
            const fallbackReplacement = findReplacement(
              num, availableMain, allCurrent, neutralNumbers, sellerHistory,
              startSet.id, true, isSmallSeller, totalNeededFromSets
            );

            if (fallbackReplacement) {
              mainNumbers.push(fallbackReplacement);
              mainStationQuantities[fallbackReplacement] = sheetsPerNumber;
              currentMainPool[fallbackReplacement] -= sheetsPerNumber;
            } else {
              shortages.push({ sellerId: seller.id, sellerName: seller.name, station: subId, needed: 1, available: 0 });
            }
          }
        }
      } else {
        // Main Station
        let finalNum = num;
        const isSmallSeller = seller.targetTotalTickets <= 160;

        const isSet00Restricted = startSet.id === '00' && (finalNum === '67' || finalNum === '48');

        const futureNumbers = initialNumbersFromSets.slice(idx + 1);
        const allCurrent = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers), ...futureNumbers];

        if (currentMainPool[finalNum] >= sheetsPerNumber && !isSet00Restricted && !allCurrent.includes(finalNum)) {
          mainNumbers.push(finalNum);
          mainStationQuantities[finalNum] = sheetsPerNumber;
          currentMainPool[finalNum] -= sheetsPerNumber;
        } else {
          const availableMain = Object.keys(currentMainPool).filter(n => {
            const isRestricted = startSet.id === '00' && (n === '67' || n === '48');
            return currentMainPool[n] >= sheetsPerNumber && !isRestricted;
          });
          const replacement = findReplacement(
            finalNum, availableMain, allCurrent, neutralNumbers, sellerHistory,
            startSet.id, true, isSmallSeller, totalNeededFromSets
          );
          if (replacement) {
            mainNumbers.push(replacement);
            mainStationQuantities[replacement] = sheetsPerNumber;
            currentMainPool[replacement] -= sheetsPerNumber;
          } else {
            shortages.push({ sellerId: seller.id, sellerName: seller.name, station: 'main', needed: 1, available: 0 });
          }
        }
      }
    });

    // Rule: Extremely Ugly must have Extremely Beautiful
    const allAssigned = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers)];
    const extremelyUglyCount = allAssigned.filter(n => EXTREMELY_UGLY_NUMBERS.includes(n)).length;
    const extremelyBeautifulCount = allAssigned.filter(n => EXTREMELY_BEAUTIFUL_NUMBERS.includes(n)).length;

    if (extremelyUglyCount > 0 && extremelyBeautifulCount === 0) {
      // Try to find Extremely Beautiful in Sub Stations first (since we can't withdraw from Main)
      let foundInSub = false;
      for (const subRes of subStationResults) {
        const subPool = currentSubPools[subRes.id];
        const availableExtremelyBeautiful = Object.keys(subPool).filter(n =>
          subPool[n] >= sheetsPerNumber &&
          EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) &&
          !allAssigned.includes(n) // AVOID DUPLICATES
        );

        if (availableExtremelyBeautiful.length > 0) {
          const beauty = availableExtremelyBeautiful[0];
          // Find a replaceable number in this sub-station's result
          const replaceableIdx = subRes.numbers.findIndex(n => !EXTREMELY_UGLY_NUMBERS.includes(n) && !UGLY_NUMBERS.includes(n));

          if (replaceableIdx !== -1) {
            const old = subRes.numbers[replaceableIdx];
            subRes.numbers[replaceableIdx] = beauty;
            subRes.quantities[beauty] = subRes.quantities[old];
            delete subRes.quantities[old];
            subPool[beauty] -= subRes.quantities[beauty];
            subPool[old] += subRes.quantities[beauty];
            foundInSub = true;
            // Update allAssigned for next iteration or beauty check
            allAssigned[allAssigned.indexOf(old)] = beauty;
            break;
          }
        }
      }

      if (!foundInSub) {
        // Try Main Station if not found in Sub
        const availableMain = Object.keys(currentMainPool).filter(n =>
          currentMainPool[n] >= sheetsPerNumber &&
          EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) &&
          !allAssigned.includes(n) // AVOID DUPLICATES
        );

        if (availableMain.length > 0) {
          const beauty = availableMain[0];
          const replaceableIdx = mainNumbers.findIndex(n => !EXTREMELY_UGLY_NUMBERS.includes(n) && !UGLY_NUMBERS.includes(n));

          if (replaceableIdx !== -1) {
            const old = mainNumbers[replaceableIdx];
            mainNumbers[replaceableIdx] = beauty;
            mainStationQuantities[beauty] = mainStationQuantities[old];
            delete mainStationQuantities[old];
            currentMainPool[beauty] -= mainStationQuantities[beauty];
            currentMainPool[old] += mainStationQuantities[beauty];
            allAssigned[allAssigned.indexOf(old)] = beauty;
          } else {
            shortages.push({
              sellerId: seller.id,
              sellerName: seller.name,
              station: 'cân bằng',
              needed: 1,
              available: 0,
              missingNumber: 'Số Cực Đẹp (để bù Số Cực Xấu)'
            });
          }
        } else {
          shortages.push({
            sellerId: seller.id,
            sellerName: seller.name,
            station: 'cân bằng',
            needed: 1,
            available: 0,
            missingNumber: 'Số Cực Đẹp (để bù Số Cực Xấu)'
          });
        }
      }
    }

    // Rule: Ugly must have Beautiful (Standard) - try sub-stations first, then main
    const uglyCount = allAssigned.filter(n => UGLY_NUMBERS.includes(n)).length;
    const beautifulCount = allAssigned.filter(n => BEAUTIFUL_NUMBERS.includes(n)).length;

    if (uglyCount > 0 && beautifulCount === 0) {
      let foundStdBeautiful = false;

      // Try sub stations first for standard beautiful
      for (const subRes of subStationResults) {
        const subPool = currentSubPools[subRes.id];
        const availableBeautiful = Object.keys(subPool).filter(n =>
          subPool[n] >= sheetsPerNumber &&
          BEAUTIFUL_NUMBERS.includes(n) &&
          !allAssigned.includes(n)
        );
        if (availableBeautiful.length > 0) {
          const beauty = availableBeautiful[0];
          const replaceableIdx = subRes.numbers.findIndex(n =>
            !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n)
          );
          if (replaceableIdx !== -1) {
            const old = subRes.numbers[replaceableIdx];
            subRes.numbers[replaceableIdx] = beauty;
            subRes.quantities[beauty] = subRes.quantities[old];
            delete subRes.quantities[old];
            subPool[beauty] -= subRes.quantities[beauty];
            subPool[old] = (subPool[old] || 0) + subRes.quantities[beauty];
            allAssigned[allAssigned.indexOf(old)] = beauty;
            foundStdBeautiful = true;
            break;
          }
        }
      }

      if (!foundStdBeautiful) {
        // Try main station
        const replaceableIdx = mainNumbers.findIndex(n => canWithdrawFromMain(n));
        if (replaceableIdx !== -1) {
          const availableMain = Object.keys(currentMainPool).filter(n =>
            currentMainPool[n] >= sheetsPerNumber &&
            BEAUTIFUL_NUMBERS.includes(n) &&
            !EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) &&
            !allAssigned.includes(n)
          );
          if (availableMain.length > 0) {
            const beauty = availableMain[0];
            const old = mainNumbers[replaceableIdx];
            mainNumbers[replaceableIdx] = beauty;
            mainStationQuantities[beauty] = mainStationQuantities[old];
            delete mainStationQuantities[old];
            currentMainPool[beauty] -= mainStationQuantities[beauty];
            currentMainPool[old] = (currentMainPool[old] || 0) + mainStationQuantities[beauty];
            allAssigned[allAssigned.indexOf(old)] = beauty;
          }
        }
      }
    }

    // 6. Desperate Fill for Shortages (Bù số để đủ lượng vé)
    const assignedCount = mainNumbers.length + subStationResults.reduce((acc, r) => acc + r.numbers.length, 0);
    const missingCount = totalNeededFromSets - assignedCount;

    if (missingCount > 0) {
      for (let i = 0; i < missingCount; i++) {
        const allCurrent = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers)];
        let filled = false;

        // Try sub stations first
        for (const subRes of subStationResults) {
          const subPool = currentSubPools[subRes.id];
          const availableSub = Object.keys(subPool).filter(n =>
            subPool[n] >= sheetsPerNumber &&
            !allCurrent.includes(n) &&
            !isNumberForbidden([...allCurrent, n]) &&
            !violatesDistributionRules(n, allCurrent, totalNeededFromSets)
          );
          if (availableSub.length > 0) {
            const num = availableSub[Math.floor(Math.random() * availableSub.length)];
            subRes.numbers.push(num);
            subRes.quantities[num] = sheetsPerNumber;
            subPool[num] -= sheetsPerNumber;
            filled = true;
            break;
          }
        }

        // Try main station next
        if (!filled) {
          const availableMain = Object.keys(currentMainPool).filter(n =>
            currentMainPool[n] >= sheetsPerNumber &&
            !allCurrent.includes(n) &&
            !isNumberForbidden([...allCurrent, n]) &&
            !violatesDistributionRules(n, allCurrent, totalNeededFromSets)
          );
          if (availableMain.length > 0) {
            const num = availableMain[Math.floor(Math.random() * availableMain.length)];
            mainNumbers.push(num);
            mainStationQuantities[num] = sheetsPerNumber;
            currentMainPool[num] -= sheetsPerNumber;
            filled = true;
          }
        }

        // Absolute desperate: ignore history/special rules, but NEVER duplicate tens
        if (!filled) {
          const desperateSub = subStationResults.flatMap(subRes => {
            return Object.keys(currentSubPools[subRes.id])
              .filter(n => currentSubPools[subRes.id][n] >= sheetsPerNumber && !allCurrent.includes(n))
              .map(n => ({ station: subRes.id, num: n }));
          });
          const desperateMain = Object.keys(currentMainPool)
            .filter(n => currentMainPool[n] >= sheetsPerNumber && !allCurrent.includes(n))
            .map(n => ({ station: 'main', num: n }));

          const allDesperate = [...desperateSub, ...desperateMain].filter(item => {
            const decade = getDecade(item.num);
            const decadeCount = allCurrent.filter(n => getDecade(n) === decade).length;
            return decadeCount === 0;
          });

          if (allDesperate.length > 0) {
            const pick = allDesperate[Math.floor(Math.random() * allDesperate.length)];
            if (pick.station === 'main') {
              mainNumbers.push(pick.num);
              mainStationQuantities[pick.num] = sheetsPerNumber;
              currentMainPool[pick.num] -= sheetsPerNumber;
            } else {
              const subRes = subStationResults.find(r => r.id === pick.station)!;
              subRes.numbers.push(pick.num);
              subRes.quantities[pick.num] = sheetsPerNumber;
              currentSubPools[pick.station][pick.num] -= sheetsPerNumber;
            }
          }
        }
      }
    }

    // 7. Post-Fill: Re-check Ugly/Beautiful balance after desperate fill
    const finalAssigned = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers)];

    // Re-check Extremely Ugly must have Extremely Beautiful
    const reExtrUgly = finalAssigned.filter(n => EXTREMELY_UGLY_NUMBERS.includes(n)).length;
    const reExtrBeautiful = finalAssigned.filter(n => EXTREMELY_BEAUTIFUL_NUMBERS.includes(n)).length;

    if (reExtrUgly > 0 && reExtrBeautiful === 0) {
      let fixed = false;
      // Try sub stations
      for (const subRes of subStationResults) {
        const subPool = currentSubPools[subRes.id];
        const available = Object.keys(subPool).filter(n =>
          subPool[n] >= sheetsPerNumber && EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) && !finalAssigned.includes(n)
        );
        if (available.length > 0) {
          const beauty = available[0];
          const ri = subRes.numbers.findIndex(n => !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n));
          if (ri !== -1) {
            const old = subRes.numbers[ri];
            subRes.numbers[ri] = beauty;
            subRes.quantities[beauty] = subRes.quantities[old];
            delete subRes.quantities[old];
            subPool[beauty] -= subRes.quantities[beauty];
            subPool[old] = (subPool[old] || 0) + subRes.quantities[beauty];
            finalAssigned[finalAssigned.indexOf(old)] = beauty;
            fixed = true;
            break;
          }
        }
      }
      if (!fixed) {
        const available = Object.keys(currentMainPool).filter(n =>
          currentMainPool[n] >= sheetsPerNumber && EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) && !finalAssigned.includes(n)
        );
        if (available.length > 0) {
          const beauty = available[0];
          const ri = mainNumbers.findIndex(n => !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n));
          if (ri !== -1) {
            const old = mainNumbers[ri];
            mainNumbers[ri] = beauty;
            mainStationQuantities[beauty] = mainStationQuantities[old];
            delete mainStationQuantities[old];
            currentMainPool[beauty] -= mainStationQuantities[beauty];
            currentMainPool[old] = (currentMainPool[old] || 0) + mainStationQuantities[beauty];
            finalAssigned[finalAssigned.indexOf(old)] = beauty;
          }
        }
      }
    }

    // Re-check Ugly must have Beautiful
    const reUgly = finalAssigned.filter(n => UGLY_NUMBERS.includes(n)).length;
    const reBeautiful = finalAssigned.filter(n => BEAUTIFUL_NUMBERS.includes(n)).length;

    if (reUgly > 0 && reBeautiful === 0) {
      let fixed = false;
      // Try sub stations first
      for (const subRes of subStationResults) {
        const subPool = currentSubPools[subRes.id];
        const available = Object.keys(subPool).filter(n =>
          subPool[n] >= sheetsPerNumber && BEAUTIFUL_NUMBERS.includes(n) && !finalAssigned.includes(n)
        );
        if (available.length > 0) {
          const beauty = available[0];
          const ri = subRes.numbers.findIndex(n => !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n));
          if (ri !== -1) {
            const old = subRes.numbers[ri];
            subRes.numbers[ri] = beauty;
            subRes.quantities[beauty] = subRes.quantities[old];
            delete subRes.quantities[old];
            subPool[beauty] -= subRes.quantities[beauty];
            subPool[old] = (subPool[old] || 0) + subRes.quantities[beauty];
            finalAssigned[finalAssigned.indexOf(old)] = beauty;
            fixed = true;
            break;
          }
        }
      }
      if (!fixed) {
        const available = Object.keys(currentMainPool).filter(n =>
          currentMainPool[n] >= sheetsPerNumber && BEAUTIFUL_NUMBERS.includes(n) &&
          !EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) && !finalAssigned.includes(n)
        );
        if (available.length > 0) {
          const beauty = available[0];
          const ri = mainNumbers.findIndex(n => canWithdrawFromMain(n));
          if (ri !== -1) {
            const old = mainNumbers[ri];
            mainNumbers[ri] = beauty;
            mainStationQuantities[beauty] = mainStationQuantities[old];
            delete mainStationQuantities[old];
            currentMainPool[beauty] -= mainStationQuantities[beauty];
            currentMainPool[old] = (currentMainPool[old] || 0) + mainStationQuantities[beauty];
            finalAssigned[finalAssigned.indexOf(old)] = beauty;
          }
        }
      }
    }

    const totalSheets = Object.values(mainStationQuantities).reduce((a, b) => a + b, 0) +
      subStationResults.reduce((acc, r) => acc + Object.values(r.quantities).reduce((a, b) => a + b, 0), 0);

    results.push({
      date,
      sellerId: seller.id,
      sellerName: seller.name,
      setName: startSet.id,
      mainStationNumbers: [...mainNumbers].sort((a, b) => parseInt(a) - parseInt(b)),
      mainStationQuantities,
      subStationResults: subStationResults.map(r => ({
        ...r,
        numbers: [...r.numbers].sort((a, b) => parseInt(a) - parseInt(b))
      })),
      totalSheets
    });
  });

  // ===== POST-DISTRIBUTION: Ugly Number Weekly Enforcement (Rule 12) =====
  // Count today's ugly number assignments
  results.forEach(r => {
    const allNums = [...r.mainStationNumbers, ...r.subStationResults.flatMap(sr => sr.numbers)];
    allNums.forEach(num => {
      if (UGLY_NUMBERS.includes(num)) {
        if (!todayUglyAssignments[num]) todayUglyAssignments[num] = [];
        todayUglyAssignments[num].push(r.sellerId);
      }
    });
  });

  // Check which ugly numbers are under-distributed (need at least 2/week)
  const underDistributedUgly = allUglyNumbers.filter(num => {
    const weeklyTotal = (weeklyUglyGlobal[num] || 0) + (todayUglyAssignments[num]?.length || 0);
    return weeklyTotal < 2;
  });

  // Try to inject under-distributed ugly numbers into sellers who:
  // 1. Didn't receive this ugly number yesterday (non-consecutive)
  // 2. Haven't received too many ugly numbers already
  // 3. Have a neutral number that can be swapped
  if (underDistributedUgly.length > 0) {
    for (const uglyNum of underDistributedUgly) {
      // Find eligible sellers (spread across sellers, don't dồn 1 người)
      const eligibleResults = results.filter(r => {
        const yesterdayUgly = yesterdayUglyPerSeller[r.sellerId] || [];
        if (yesterdayUgly.includes(uglyNum)) return false; // Non-consecutive
        const allNums = [...r.mainStationNumbers, ...r.subStationResults.flatMap(sr => sr.numbers)];
        if (allNums.includes(uglyNum)) return false; // Already has it
        if (isForbidden([...allNums, uglyNum])) return false; // Forbidden combo
        // Count ugly numbers already assigned to this seller today
        const uglyCount = allNums.filter(n => UGLY_NUMBERS.includes(n)).length;
        if (uglyCount >= 3) return false; // Don't overload one seller
        return true;
      });

      if (eligibleResults.length > 0) {
        // Pick the seller with the fewest ugly numbers today
        const target = eligibleResults.sort((a, b) => {
          const aUgly = [...a.mainStationNumbers, ...a.subStationResults.flatMap(sr => sr.numbers)]
            .filter(n => UGLY_NUMBERS.includes(n)).length;
          const bUgly = [...b.mainStationNumbers, ...b.subStationResults.flatMap(sr => sr.numbers)]
            .filter(n => UGLY_NUMBERS.includes(n)).length;
          return aUgly - bUgly;
        })[0];

        // Find a neutral number in main to swap
        const neutralIdx = target.mainStationNumbers.findIndex(n =>
          !BEAUTIFUL_NUMBERS.includes(n) &&
          !UGLY_NUMBERS.includes(n) &&
          !EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) &&
          n !== '63'
        );

        if (neutralIdx !== -1 && currentMainPool[uglyNum] !== undefined) {
          const oldNum = target.mainStationNumbers[neutralIdx];
          const qty = target.mainStationQuantities?.[oldNum] || 16;
          target.mainStationNumbers[neutralIdx] = uglyNum;
          if (target.mainStationQuantities) {
            target.mainStationQuantities[uglyNum] = qty;
            delete target.mainStationQuantities[oldNum];
          }
          // Return old number to pool, take ugly from pool
          currentMainPool[oldNum] = (currentMainPool[oldNum] || 0) + qty;
          currentMainPool[uglyNum] = (currentMainPool[uglyNum] || 0) - qty;
          target.mainStationNumbers.sort((a, b) => parseInt(a) - parseInt(b));
        }
      }
    }
  }

  // ===== POST-DISTRIBUTION: Upgrade Logic (Rule 3: 40→45, 80→85) =====
  // If a seller has 40 but pool has 45 available, upgrade
  // If a seller has 80 but pool has 85 available, upgrade
  const upgradePairs: [string, string][] = [['40', '45'], ['80', '85']];
  for (const result of results) {
    for (const [from, to] of upgradePairs) {
      const mainIdx = result.mainStationNumbers.indexOf(from);
      if (mainIdx !== -1 && !result.mainStationNumbers.includes(to)) {
        const allNums = [...result.mainStationNumbers, ...result.subStationResults.flatMap(sr => sr.numbers)];
        if (!isForbidden([...allNums.filter(n => n !== from), to])) {
          const qty = result.mainStationQuantities?.[from] || 16;
          if (currentMainPool[to] !== undefined && currentMainPool[to] >= qty) {
            result.mainStationNumbers[mainIdx] = to;
            if (result.mainStationQuantities) {
              result.mainStationQuantities[to] = qty;
              delete result.mainStationQuantities[from];
            }
            currentMainPool[from] = (currentMainPool[from] || 0) + qty;
            currentMainPool[to] -= qty;
            result.mainStationNumbers.sort((a, b) => parseInt(a) - parseInt(b));
          }
        }
      }
    }
  }

  // ===== POST-DISTRIBUTION: Validation (Rule 14: Check trước khi chốt) =====
  const validationWarnings = validateDistributionResults(results, history, enabledSellers.map(e => e.seller));
  if (validationWarnings.length > 0) {
    validationWarnings.forEach(warning => {
      shortages.push({
        sellerId: warning.sellerId,
        sellerName: warning.sellerName,
        station: 'kiểm tra',
        needed: 0,
        available: 0,
        missingNumber: warning.message
      });
    });
  }

  return { results, shortages, updatedMainPool: currentMainPool, updatedSubPools: currentSubPools };
}

// ===== Rule 14: Validate Distribution Results (Check trước khi chốt) =====
interface ValidationWarning {
  sellerId: string;
  sellerName: string;
  message: string;
}

function validateDistributionResults(
  results: DistributionResult[],
  history: DistributionResult[][],
  sellers: Seller[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const result of results) {
    const allNums = [...result.mainStationNumbers, ...result.subStationResults.flatMap(sr => sr.numbers)];
    const seller = sellers.find(s => s.id === result.sellerId);

    // 1. Check: Không rút số cấm (shouldn't have removed forbidden numbers from set)
    // This is enforced during distribution, just verify

    // 2. Check: Không trùng 2 ngày
    const recentHistory = history.slice(0, 2)
      .flatMap(dayResults => dayResults.filter(r => r.sellerId === result.sellerId))
      .flatMap(r => [...r.mainStationNumbers, ...r.subStationResults.flatMap(sr => sr.numbers)]);
    const repeatedIn2Days = allNums.filter(n => recentHistory.includes(n));
    if (repeatedIn2Days.length > 0) {
      warnings.push({
        sellerId: result.sellerId,
        sellerName: result.sellerName,
        message: `⚠️ Trùng 2 ngày: ${repeatedIn2Days.join(', ')}`
      });
    }

    // 3. Check: Khách lớn không trùng hàng
    const isLargeSeller = seller && seller.targetTotalTickets > 480; // ~30 numbers
    if (isLargeSeller) {
      const decadeCounts: Record<number, number> = {};
      allNums.forEach(n => {
        const d = getDecade(n);
        decadeCounts[d] = (decadeCounts[d] || 0) + 1;
      });
      const duplicateDecades = Object.entries(decadeCounts)
        .filter(([_, count]) => count > Math.ceil(allNums.length / 10))
        .map(([decade]) => `${decade}x`);
      if (duplicateDecades.length > 0) {
        warnings.push({
          sellerId: result.sellerId,
          sellerName: result.sellerName,
          message: `⚠️ Khách lớn trùng hàng: ${duplicateDecades.join(', ')}`
        });
      }
    }

    // 4. Check: Trùng đuôi trong mức cho phép
    const endingCounts: Record<string, number> = {};
    allNums.forEach(n => {
      const e = n.slice(-1);
      endingCounts[e] = (endingCounts[e] || 0) + 1;
    });
    const maxEnding = isLargeSeller ? Math.max(3, Math.ceil(allNums.length / 10)) : 2;
    const excessEndings = Object.entries(endingCounts)
      .filter(([_, count]) => count > maxEnding)
      .map(([ending, count]) => `đuôi ${ending}(${count})`);
    if (excessEndings.length > 0) {
      warnings.push({
        sellerId: result.sellerId,
        sellerName: result.sellerName,
        message: `⚠️ Trùng đuôi quá mức: ${excessEndings.join(', ')}`
      });
    }

    // 5. Check: 3x-7x đúng luật (phải có số 3x/7x backbone)
    const has3x = allNums.some(n => getDecade(n) === 3);
    const has7x = allNums.some(n => getDecade(n) === 7);
    if (allNums.length >= 10 && !has3x) {
      warnings.push({
        sellerId: result.sellerId,
        sellerName: result.sellerName,
        message: `⚠️ Thiếu số hàng 3x (xương sống)`
      });
    }
    if (allNums.length >= 10 && !has7x) {
      warnings.push({
        sellerId: result.sellerId,
        sellerName: result.sellerName,
        message: `⚠️ Thiếu số hàng 7x (xương sống)`
      });
    }

    // 6. Check: Số xấu đã được chia (at least some ugly in each result with enough numbers)
    if (allNums.length >= 10) {
      const hasUgly = allNums.some(n => UGLY_NUMBERS.includes(n));
      const hasBeautiful = allNums.some(n => BEAUTIFUL_NUMBERS.includes(n));
      if (hasUgly && !hasBeautiful) {
        warnings.push({
          sellerId: result.sellerId,
          sellerName: result.sellerName,
          message: `⚠️ Có số xấu nhưng thiếu số đẹp để cân bằng`
        });
      }
    }
  }

  return warnings;
}

// Helper for Rule 5: Replacement
function findReplacement(
  targetNum: string,
  pool: string[],
  existing: string[],
  neutralPool: string[],
  history: string[],
  setId?: string,
  forceSameDecade: boolean = false,
  isSmallSeller: boolean = false,
  targetTotal: number = 10
): string | null {
  const targetEnding = targetNum.slice(-1);
  const targetDecade = getDecade(targetNum);

  const otherExisting = existing.filter(n => n !== targetNum);

  // Base pool: Remove already used, history, forbidden, EXTREMELY BEAUTIFUL, x0 endings, ugly numbers
  // Rule: "25→20 sai" - cannot replace with x0 ending
  // Rule: "TUYỆT ĐỐI KHÔNG RÚT SỐ CỰC ĐẸP"
  let safePool = pool.filter(n =>
    !existing.includes(n) &&
    !history.includes(n) &&
    !isForbidden([...otherExisting, n], setId) &&
    !EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) &&
    n.slice(-1) !== '0' && // Rule: Cannot replace with x0 ending (25→20 sai)
    !UGLY_NUMBERS.includes(n) // Don't use ugly numbers as replacements casually
  );

  // Apply Set 00 restrictions for Main withdrawal
  if (setId === '00') {
    safePool = safePool.filter(n => n !== '67' && n !== '48');
  }

  if (safePool.length === 0) return null;

  // Define "Restricted" pool (All 3x/7x backbone, 9x for small sellers, x8 for non-00 sets)
  const isRestricted = (n: string) => {
    const decade = getDecade(n);
    const ending = n.slice(-1);

    // ALL 3x/7x numbers are backbone - restrict (not just beautiful ones)
    if (decade === 3 || decade === 7) return true;

    // 9x for small sellers is restricted
    if (isSmallSeller && decade === 9) return true;

    // x8 for non-00 sets is restricted
    if (setId !== '00' && ending === '8') return true;

    return false;
  };

  const preferredPool = safePool.filter(n => !isRestricted(n));
  const fallbackPool = safePool.filter(n => isRestricted(n));

  // Try preferred pool first, then fallback
  const searchPools = [preferredPool, fallbackPool];

  // Rule: 3x/7x MUST be replaced with same decade - no fallback
  const is3x7xTarget = targetDecade === 3 || targetDecade === 7;

  for (const currentPool of searchPools) {
    if (currentPool.length === 0) continue;

    let filteredPool = currentPool;
    if (forceSameDecade) {
      const decadePool = currentPool.filter(n => getDecade(n) === targetDecade);
      if (decadePool.length > 0) {
        filteredPool = decadePool;
      } else if (is3x7xTarget) {
        // 3x/7x: nếu rút → phải thay cùng hàng, không có thì bỏ qua
        continue;
      }
    }

    // New Priority System based on user's "No duplicate decade" and "Max 2 duplicate ending" rules
    // Priority 1: Valid decade AND Valid ending
    const p1 = filteredPool.filter(n => !violatesDistributionRules(n, otherExisting, targetTotal));
    if (p1.length > 0) {
      // Within p1, prefer same decade or same ending if possible (to stay close to target)
      const p1a = p1.filter(n => getDecade(n) === targetDecade && n.slice(-1) === targetEnding);
      if (p1a.length > 0) return p1a[Math.floor(Math.random() * p1a.length)];

      const p1b = p1.filter(n => getDecade(n) === targetDecade || n.slice(-1) === targetEnding);
      if (p1b.length > 0) return p1b[Math.floor(Math.random() * p1b.length)];

      return p1[Math.floor(Math.random() * p1.length)];
    }

    // Priority 2: Valid decade (even if ending is duplicate)
    const p2 = filteredPool.filter(n => {
      const decade = getDecade(n);
      const maxDecade = Math.ceil(targetTotal / 10);
      return otherExisting.filter(ex => getDecade(ex) === decade).length < maxDecade;
    });
    if (p2.length > 0) return p2[Math.floor(Math.random() * p2.length)];

    // Priority 3: Valid ending (even if decade is duplicate)
    const p3 = filteredPool.filter(n => {
      const ending = n.slice(-1);
      const maxEnding = Math.max(2, Math.ceil(targetTotal / 10));
      return otherExisting.filter(ex => ex.slice(-1) === ending).length < maxEnding;
    });
    if (p3.length > 0) return p3[Math.floor(Math.random() * p3.length)];

    // Fallback: Any number from filteredPool
    if (filteredPool.length > 0) return filteredPool[Math.floor(Math.random() * filteredPool.length)];
  }

  return null;
}
