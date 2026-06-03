// Scoring logic shared with Cloud Functions

export interface PredictionInput {
  predictedHomeGoals: number;
  predictedAwayGoals: number;
}

export interface ResultInput {
  homeGoals: number;
  awayGoals: number;
}

export function outcome(home: number, away: number): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function calculatePoints(
  prediction: PredictionInput,
  result: ResultInput
): number {
  if (
    prediction.predictedHomeGoals === result.homeGoals &&
    prediction.predictedAwayGoals === result.awayGoals
  ) {
    return 3;
  }
  if (
    prediction.predictedHomeGoals === prediction.predictedAwayGoals &&
    result.homeGoals === result.awayGoals
  ) {
    return 2;
  }
  if (
    outcome(prediction.predictedHomeGoals, prediction.predictedAwayGoals) ===
    outcome(result.homeGoals, result.awayGoals)
  ) {
    return 1;
  }
  return 0;
}
