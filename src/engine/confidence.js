// confidence.js - compute confidence score from accuracy, speed, and recency

// speed in seconds (avg), accuracy in percent (0-100), recencyDays = days since last activity
export function computeConfidence(accuracyPercent, avgSpeedSeconds, recencyDays) {
  // normalize: accuracy 0-100, speed factor: faster -> better, map 5s..60s -> 100..0
  const speedFactor = Math.max(0, Math.min(1, (60 - Math.min(60, avgSpeedSeconds)) / 55)); // 60->0, 5->1
  const recencyFactor = Math.max(0, Math.min(1, Math.max(0, 30 - recencyDays) / 30));
  const score = 0.6 * (accuracyPercent / 100) + 0.3 * speedFactor + 0.1 * recencyFactor;
  return Math.round(score * 100);
}

export function questionsPerTopic(confidence) {
  const result = 6 - Math.floor(confidence / 20);
  return Math.max(1, result);
}

export default { computeConfidence, questionsPerTopic };
