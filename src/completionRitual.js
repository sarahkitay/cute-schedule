// Completion Rituals - Using The Gentle Anchor system
import { generateCompletionMessage as gentleCompletion, inferEmotionalState } from './gentleAnchor';

export function generateCompletionMessage(task, category, completedToday, energyLevel, categoryTone) {
  // Use the new gentle anchor system
  const tasks = []; // This would come from state - simplified for now
  const state = inferEmotionalState(tasks, "afternoon");
  return gentleCompletion(task, category, completedToday, energyLevel, state);
}

export function checkEnergyBalance(tasksByHour) {
  const heavyCount = {};
  Object.entries(tasksByHour).forEach(([hour, tasks]) => {
    const heavy = Object.values(tasks).flat().filter(t => t.energyLevel === 'HEAVY').length;
    if (heavy > 0) {
      heavyCount[hour] = heavy;
    }
  });

  const sortedHours = Object.keys(heavyCount).sort();
  const warnings = [];
  
  for (let i = 0; i < sortedHours.length - 1; i++) {
    const current = sortedHours[i];
    const next = sortedHours[i + 1];
    const [currH, currM] = current.split(':').map(Number);
    const [nextH, nextM] = next.split(':').map(Number);
    
    const timeDiff = (nextH * 60 + nextM) - (currH * 60 + currM);
    
    if (timeDiff <= 90 && heavyCount[current] > 0 && heavyCount[next] > 0) {
      warnings.push({
        hour: next,
        message: `You scheduled two heavy tasks back to back. Want to soften the afternoon?`
      });
    }
  }

  return warnings;
}
