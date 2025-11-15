import { DEFAULT_UI_MODE } from '../config/ui.js';
import { adaptNarrative } from './adapter-narrative.js';
import { adaptMetrics } from './adapter-metrics.js';

export function prepareUiPayload({ report, metrics, options } = {}) {
  const uiMode = options?.uiMode || DEFAULT_UI_MODE;
  const adaptedReport = adaptNarrative({ uiMode, draft: report });
  const adaptedMetrics = metrics != null ? adaptMetrics({ uiMode, raw: metrics }) : metrics;
  return {
    report: adaptedReport,
    metrics: adaptedMetrics
  };
}
