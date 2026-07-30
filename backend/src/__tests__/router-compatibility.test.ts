import { getCompatibilityRules } from '@/lib/versionCompatibility';

describe('Version compatibility registry', () => {
  it('marks RouterOS v7 features as supported', () => {
    const rules = getCompatibilityRules('mikrotik', '7.15');
    expect(rules.some((rule) => rule.feature === 'REST API' && rule.supported)).toBe(true);
  });

  it('marks non-MikroTik vendors with capability-specific rules', () => {
    const omadaRules = getCompatibilityRules('omada', '1.32.0');
    expect(omadaRules.some((rule) => rule.feature === 'CAPsMAN' && rule.supported)).toBe(true);
  });
});
