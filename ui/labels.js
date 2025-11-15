export const LABELS_PLAIN = {
  ACWR: {
    label: 'Weekly workload balance',
    detail: 'Compares this week\'s training load to the four-week baseline.',
    tooltip: '1.0 means matching the four-week average; above 1.2 signals higher-than-normal load.',
    aliases: ['LOAD_RATIO', 'ACWR_RATIO', 'WORKLOAD_RATIO']
  },
  SRI: {
    label: 'Sleep rhythm score',
    detail: 'Measures how consistent bedtime and wake times were across the week.',
    tooltip: 'Higher values mean steadier routines; 70+ generally reflects reliable sleep timing.',
    aliases: ['SLEEP_REGULARITY', 'SLEEP_CONSISTENCY']
  },
  RHR_DELTA: {
    label: 'Resting heart rate shift',
    detail: 'Shows the change in resting heart rate compared to the normal baseline.',
    tooltip: 'Elevated resting heart rate can indicate fatigue or accumulating stress.',
    aliases: ['RHR', 'RHR_CHANGE', 'RESTING_HEART_RATE_DELTA']
  },
  STEPS: {
    label: 'Daily steps trend',
    detail: 'Average daily steps recorded this week relative to the goal.',
    tooltip: 'Supports the fitness read by showing how walking volume tracked against targets.',
    aliases: ['DAILY_STEPS', 'STEP_COUNT', 'STEPS_TREND']
  },
  CAPACITY: {
    label: 'Capacity status',
    detail: 'Plain-language summary of how ready the body is for harder weeks.',
    tooltip: 'Blends load, recovery, and resting heart rate signals into one simple read.',
    aliases: ['READINESS_CAPACITY', 'CAPACITY_STATUS', 'CAPACITY_LABEL']
  }
};
