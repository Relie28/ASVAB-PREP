// difficulty.js - simple adaptive difficulty adjustment

// difficulty is integer 1..5
export function adjustDifficulty(currentDifficulty, accuracyPercent, avgSpeedSeconds) {
  let newDiff = currentDifficulty || 3;
  if (accuracyPercent >= 85 && avgSpeedSeconds < 18) {
    newDiff = Math.min(5, newDiff + 1);
  }
  if (accuracyPercent < 50) {
    newDiff = Math.max(1, newDiff - 1);
  }
  return newDiff;
}

export default adjustDifficulty;
