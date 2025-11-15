import { UI_MODE } from '../config/ui.js';
import { LABELS_PLAIN } from './labels.js';

const METRIC_KEYS = ['metric', 'id', 'key', 'code', 'slug'];

const LABEL_LOOKUP = Object.entries(LABELS_PLAIN).reduce((acc, [baseKey, config]) => {
  const normalizedKey = normalizeMetricKey(baseKey);
  if (normalizedKey) acc[normalizedKey] = config;
  for (const alias of config.aliases || []) {
    const normalizedAlias = normalizeMetricKey(alias);
    if (normalizedAlias && !acc[normalizedAlias]) {
      acc[normalizedAlias] = config;
    }
  }
  return acc;
}, {});

export function adaptMetrics({ uiMode, raw }) {
  if (uiMode !== UI_MODE.PLAIN) return raw;
  return adaptNode(raw);
}

function adaptNode(node) {
  if (Array.isArray(node)) {
    return node.map(item => adaptNode(item));
  }
  if (!node || typeof node !== 'object') {
    return node;
  }

  const mapping = getMappingForNode(node);
  const adapted = {};

  for (const [key, value] of Object.entries(node)) {
    adapted[key] = adaptNode(value);
  }

  if (mapping) {
    applyMapping(adapted, mapping);
  }

  return adapted;
}

function applyMapping(target, mapping) {
  if (mapping.label) {
    target.label = mapping.label;
  }
  if (mapping.metric) {
    target.metric = mapping.metric;
  }
  if (mapping.detail) {
    if ('detail' in target) {
      target.detail = mapping.detail;
    } else if (!('description' in target)) {
      target.detail = mapping.detail;
    }
  }
  if (mapping.description) {
    target.description = mapping.description;
  }
  if (mapping.tooltip) {
    if (target.tooltip && typeof target.tooltip === 'object' && !Array.isArray(target.tooltip)) {
      target.tooltip = { ...target.tooltip, text: mapping.tooltip };
    } else {
      target.tooltip = mapping.tooltip;
    }
  }
  if (mapping.tag) {
    if (target.tag && typeof target.tag === 'object' && !Array.isArray(target.tag)) {
      target.tag = { ...target.tag, label: mapping.tag };
    } else {
      target.tag = mapping.tag;
    }
  }
  if (mapping.badge) {
    if (target.badge && typeof target.badge === 'object' && !Array.isArray(target.badge)) {
      target.badge = { ...target.badge, ...mapping.badge };
    } else {
      target.badge = mapping.badge;
    }
  }
}

function getMappingForNode(node) {
  for (const key of METRIC_KEYS) {
    const value = node[key];
    const mapping = findMapping(value);
    if (mapping) return mapping;
  }

  if (node.badge && typeof node.badge === 'object') {
    const badgeMapping = findMapping(node.badge.label);
    if (badgeMapping) return badgeMapping;
  }

  if (node.tag && typeof node.tag === 'object') {
    const tagMapping = findMapping(node.tag.label);
    if (tagMapping) return tagMapping;
  }

  if (typeof node.label === 'string' && hasMetricHints(node)) {
    const labelMapping = findMapping(node.label);
    if (labelMapping) return labelMapping;
  }

  return null;
}

function hasMetricHints(node) {
  return (
    'value' in node ||
    'detail' in node ||
    'description' in node ||
    'tooltip' in node ||
    'badge' in node ||
    'tag' in node
  );
}

function findMapping(value) {
  const key = normalizeMetricKey(value);
  if (!key) return null;
  return LABEL_LOOKUP[key] || null;
}

function normalizeMetricKey(value) {
  if (typeof value !== 'string') return null;
  return value
    .trim()
    .replace(/[\u0394\u2206]/gi, '_DELTA_')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}
