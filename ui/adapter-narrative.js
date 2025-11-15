import { UI_MODE } from '../config/ui.js';
import { titlePlain, bulletPlain, recPlain } from './text.js';

const SECTION_KEYS = ['activity', 'recovery', 'readiness'];

export function adaptNarrative({ uiMode, draft }) {
  if (uiMode !== UI_MODE.PLAIN || !draft?.sections) return draft;

  const adapted = {
    ...draft,
    sections: { ...draft.sections }
  };

  SECTION_KEYS.forEach(key => {
    const original = adapted.sections[key] || {};
    adapted.sections[key] = { ...original };
    adapted.sections[key].title = titlePlain({
      status: original.status || 'on goal',
      driver: original.driver || original.title || key
    });
  });

  SECTION_KEYS.forEach(key => {
    const section = adapted.sections[key] || {};
    const bullets = Array.isArray(section.bullets) ? section.bullets : [];
    adapted.sections[key].bullets = bullets.map(item => {
      if (item && typeof item === 'object') return bulletPlain(item);
      const parts = String(item || '').split(/\u2014|:/);
      return bulletPlain({
        vsGoal: parts[0],
        action: parts[1] || 'Take the simplest next step'
      });
    });
  });

  adapted.recommendations = recPlain(draft.recommendations || []);

  return adapted;
}
