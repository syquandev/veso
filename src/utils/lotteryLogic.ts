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
  
  // Rule: Max occurrences per ending (Max 2)
  // User: "không thể trùng đuôi nhiều hơn 2 lần"
  const maxEnding = Math.max(2, Math.ceil(targetTotal / 10));
  const endingCount = existing.filter(n => n.slice(-1) === ending).length;
  if (endingCount >= maxEnding) return true;

  // Rule: Balanced Decades (No duplicate decades if possible, or balanced)
  const maxDecade = Math.ceil(targetTotal / 10);
  const decadeCount = existing.filter(n => getDecade(n) === decade).length;
  if (decadeCount >= maxDecade) return true;

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

  // 1. Determine Base Set Index from Date
  const day = new Date(date).getDate();
  const baseSetIndex = (day - 1) % lotterySets.length;

  sellers.filter(s => s.isEnabled).forEach((seller, sIdx) => {
    // Get seller history for "not in last 2 days" rule
    const sellerHistory = history
      .slice(0, 2)
      .flatMap(dayResults => dayResults.filter(r => r.sellerId === seller.id))
      .flatMap(r => [
        ...r.mainStationNumbers, 
        ...r.subStationResults.flatMap(sr => sr.numbers)
      ]);

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
      const mainRatio = seller.customRatio !== undefined ? seller.customRatio / 100 : 0.7;
      targetMainCount = seller.mainEnabled ? Math.round(remainingNumbersNeeded * mainRatio) : 0;
      
      const totalSubNeeded = remainingNumbersNeeded - targetMainCount;
      const subStationIds = Object.keys(seller.subStationRatios);
      const totalSubRatio = Object.values(seller.subStationRatios).reduce((a, b) => a + b, 0);
      
      if (totalSubRatio > 0) {
        let allocatedSub = 0;
        subStationIds.forEach((id, idx) => {
          if (idx === subStationIds.length - 1) {
            targetSubCounts[id] = totalSubNeeded - allocatedSub;
          } else {
            const count = Math.round((seller.subStationRatios[id] / totalSubRatio) * totalSubNeeded);
            targetSubCounts[id] = count;
            allocatedSub += count;
          }
        });
      } else if (totalSubNeeded > 0 && subStationIds.length > 0) {
        const countPerSub = Math.floor(totalSubNeeded / subStationIds.length);
        subStationIds.forEach((id, idx) => {
          targetSubCounts[id] = idx === subStationIds.length - 1 ? totalSubNeeded - (countPerSub * (subStationIds.length - 1)) : countPerSub;
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
                const availableMain = Object.keys(currentMainPool).filter(n => currentMainPool[n] > 0);
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
          const available0x = Object.keys(currentMainPool).filter(n => currentMainPool[n] > 0 && getDecade(n) === 0 && !initialNumbersFromSets.includes(n));
          if (available0x.length > 0) {
            initialNumbersFromSets[replaceableIdx] = available0x[0];
            needed0x--;
            continue;
          }
        }
        if (needed9x > 0) {
          const available9x = Object.keys(currentMainPool).filter(n => currentMainPool[n] > 0 && getDecade(n) === 9 && !initialNumbersFromSets.includes(n));
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
      const setsCount = Math.floor(totalAssignedCount / 10);
      ensureDecades(setsCount, setsCount); // e.g. 30 numbers -> 3 of each
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
          const availableMain = Object.keys(currentMainPool).filter(n => currentMainPool[n] > 0 && getDecade(n) === d);
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
      const badNums = ['85', '45'].filter(n => currentMainPool[n] > 0 && !initialNumbersFromSets.includes(n));
      if (badNums.length > 0) {
        const replaceableIdx = initialNumbersFromSets.findIndex(n => !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n));
        if (replaceableIdx !== -1) initialNumbersFromSets[replaceableIdx] = badNums[0];
      }
    }
    if (['08', '09'].includes(startSet.id)) {
      // Prioritize adding 04 or 05
      const badNums = ['04', '05'].filter(n => currentMainPool[n] > 0 && !initialNumbersFromSets.includes(n));
      if (badNums.length > 0) {
        const replaceableIdx = initialNumbersFromSets.findIndex(n => !UGLY_NUMBERS.includes(n) && !BEAUTIFUL_NUMBERS.includes(n));
        if (replaceableIdx !== -1) initialNumbersFromSets[replaceableIdx] = badNums[0];
      }
    }

    // 5. Distribute initialNumbersFromSets to Main and Sub stations
    const isReplaceable = (n: string) => {
      const val = parseInt(n);
      return neutralNumbers.includes(n) && val >= 10 && val < 90;
    };

    const replaceableIndices: number[] = [];
    initialNumbersFromSets.forEach((n, i) => {
      if (isReplaceable(n)) replaceableIndices.push(i);
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

    initialNumbersFromSets.forEach((num, idx) => {
      const subId = indicesToReplace[idx];
      if (subId) {
        const subPool = currentSubPools[subId] || {};
        const subResult = subStationResults.find(r => r.id === subId)!;
        const availableSub = Object.keys(subPool).filter(n => subPool[n] > 0);
        const isSmallSeller = seller.targetTotalTickets <= 160;
        
        let replacement: string | null = null;
        // Priority: Exact same number in Sub pool
        const currentAssigned = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers)];
        if (availableSub.includes(num) && !isForbidden([...currentAssigned, num], startSet.id)) {
          replacement = num;
        } else {
          // If not available, find replacement in same decade to maintain structure
          // CRITICAL: Avoid duplicates across ALL stations and future numbers in the set
          const futureNumbers = initialNumbersFromSets.slice(idx + 1);
          const allCurrent = [...currentAssigned, ...futureNumbers];
          
          replacement = findReplacement(
            num, 
            availableSub, 
            allCurrent, 
            neutralNumbers, 
            sellerHistory, 
            startSet.id, 
            true, 
            isSmallSeller,
            totalNeededFromSets
          );
        }

        if (replacement) {
          subResult.numbers.push(replacement);
          subResult.quantities[replacement] = sheetsPerNumber;
          subPool[replacement]--;
        } else {
          // Fallback to Main if Sub is empty
          const futureNumbers = initialNumbersFromSets.slice(idx + 1);
          const allCurrent = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers), ...futureNumbers];
          
          if (currentMainPool[num] > 0 && !allCurrent.includes(num)) {
            mainNumbers.push(num);
            mainStationQuantities[num] = sheetsPerNumber;
            currentMainPool[num]--;
          } else {
            const availableMain = Object.keys(currentMainPool).filter(n => currentMainPool[n] > 0);
            const fallbackReplacement = findReplacement(
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
            
            if (fallbackReplacement) {
              mainNumbers.push(fallbackReplacement);
              mainStationQuantities[fallbackReplacement] = sheetsPerNumber;
              currentMainPool[fallbackReplacement]--;
            } else {
              shortages.push({ sellerId: seller.id, sellerName: seller.name, station: subId, needed: 1, available: 0 });
            }
          }
        }
      } else {
        // Main Station
        let finalNum = num;
        const isSmallSeller = seller.targetTotalTickets <= 160;
        
        // Rule: Ở BỘ 00 CHỈ CÓ KHÔNG ĐƯỢC RÚT CON 67, 48
        const isSet00Restricted = startSet.id === '00' && (finalNum === '67' || finalNum === '48');
        
        const futureNumbers = initialNumbersFromSets.slice(idx + 1);
        const allCurrent = [...mainNumbers, ...subStationResults.flatMap(r => r.numbers), ...futureNumbers];

        if (currentMainPool[finalNum] > 0 && !isSet00Restricted && !allCurrent.includes(finalNum)) {
          mainNumbers.push(finalNum);
          mainStationQuantities[finalNum] = sheetsPerNumber;
          currentMainPool[finalNum]--;
        } else {
          const availableMain = Object.keys(currentMainPool).filter(n => {
            const isRestricted = startSet.id === '00' && (n === '67' || n === '48');
            return currentMainPool[n] > 0 && !isRestricted;
          });
          // Maintain decade structure even in Main replacement
          const replacement = findReplacement(
            finalNum, 
            availableMain, 
            allCurrent, 
            neutralNumbers, 
            sellerHistory, 
            startSet.id, 
            true, 
            isSmallSeller,
            totalNeededFromSets
          );
          if (replacement) {
            mainNumbers.push(replacement);
            mainStationQuantities[replacement] = sheetsPerNumber;
            currentMainPool[replacement]--;
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
          subPool[n] > 0 && 
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
            subPool[beauty]--;
            subPool[old]++;
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
          currentMainPool[n] > 0 && 
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
            currentMainPool[beauty]--;
            currentMainPool[old]++;
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

    // Rule: Ugly must have Beautiful (Standard)
    const uglyCount = allAssigned.filter(n => UGLY_NUMBERS.includes(n)).length;
    const beautifulCount = allAssigned.filter(n => BEAUTIFUL_NUMBERS.includes(n)).length;
    
    if (uglyCount > 0 && beautifulCount === 0) {
      const replaceableIdx = mainNumbers.findIndex(n => isReplaceable(n));
      if (replaceableIdx !== -1) {
        // Standard Beautiful can be taken from Main if available, but NOT Extremely Beautiful
        const availableMain = Object.keys(currentMainPool).filter(n => 
          currentMainPool[n] > 0 && 
          BEAUTIFUL_NUMBERS.includes(n) && 
          !EXTREMELY_BEAUTIFUL_NUMBERS.includes(n) &&
          !allAssigned.includes(n) // AVOID DUPLICATES
        );
        if (availableMain.length > 0) {
          const beauty = availableMain[0];
          const old = mainNumbers[replaceableIdx];
          mainNumbers[replaceableIdx] = beauty;
          mainStationQuantities[beauty] = mainStationQuantities[old];
          delete mainStationQuantities[old];
          currentMainPool[beauty]--;
          currentMainPool[old]++;
          allAssigned[allAssigned.indexOf(old)] = beauty;
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

  return { results, shortages, updatedMainPool: currentMainPool, updatedSubPools: currentSubPools };
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
  
  // Base pool: Remove already used, history, forbidden, and EXTREMELY BEAUTIFUL
  // User: "TUYẾT ĐỐI KHÔNG RÚT SỐ CỰC ĐẸP KHÔNG CÓ TRƯỜNG HỢP NÀO HẾT"
  let safePool = pool.filter(n => 
    !existing.includes(n) && 
    !history.includes(n) &&
    !isForbidden([...otherExisting, n], setId) &&
    !EXTREMELY_BEAUTIFUL_NUMBERS.includes(n)
  );

  // Apply Set 00 restrictions for Main withdrawal
  if (setId === '00') {
    safePool = safePool.filter(n => n !== '67' && n !== '48');
  }

  if (safePool.length === 0) return null;

  // Define "Restricted" pool (Beautiful 3x/7x, 9x for small sellers, x8 for non-00 sets)
  const isRestricted = (n: string) => {
    const decade = getDecade(n);
    const ending = n.slice(-1);
    
    // Beautiful 3x/7x are restricted
    if ((decade === 3 || decade === 7) && BEAUTIFUL_NUMBERS.includes(n)) return true;
    
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

  for (const currentPool of searchPools) {
    if (currentPool.length === 0) continue;

    let filteredPool = currentPool;
    if (forceSameDecade) {
      const decadePool = currentPool.filter(n => getDecade(n) === targetDecade);
      if (decadePool.length > 0) filteredPool = decadePool;
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
