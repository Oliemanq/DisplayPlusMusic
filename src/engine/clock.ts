export const Clock = {
  now: (): number => Date.now(),
  performanceNow: (): number => performance.now(),
};
