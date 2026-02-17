export interface AutofixLoopResult {
  passed: boolean;
  round: number;
  needsHuman?: boolean;
}

export async function runAutofixLoop(
  runOnce: () => Promise<boolean>,
  maxRounds = 3
): Promise<AutofixLoopResult> {
  for (let i = 1; i <= maxRounds; i += 1) {
    if (await runOnce()) {
      return {
        passed: true,
        round: i
      };
    }
  }

  return {
    passed: false,
    needsHuman: true,
    round: maxRounds
  };
}
