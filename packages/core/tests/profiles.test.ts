import { describe, it, expect } from 'vitest';
import * as yaml from 'js-yaml';
import { PROFILES, getProfile } from '../src/profiles.js';
import { parsePolicy } from '../src/schema.js';

describe('PROFILES', () => {
  it('exports minimal, strict-oss, and security-sensitive profiles', () => {
    expect(PROFILES).toHaveProperty('minimal');
    expect(PROFILES).toHaveProperty('strict-oss');
    expect(PROFILES).toHaveProperty('security-sensitive');
  });

  for (const [name, yamlStr] of Object.entries(PROFILES)) {
    it(`profile "${name}" is valid YAML`, () => {
      expect(() => yaml.load(yamlStr)).not.toThrow();
    });

    it(`profile "${name}" parses as a valid AgentOwnersPolicy`, () => {
      const parsed = yaml.load(yamlStr);
      expect(() => parsePolicy(parsed)).not.toThrow();
    });

    it(`profile "${name}" has version 1`, () => {
      const parsed = yaml.load(yamlStr) as { version: number };
      expect(parsed.version).toBe(1);
    });

    it(`profile "${name}" has at least one rule`, () => {
      const parsed = yaml.load(yamlStr) as { rules?: unknown[] };
      expect(Array.isArray(parsed.rules)).toBe(true);
      expect((parsed.rules ?? []).length).toBeGreaterThan(0);
    });

    it(`profile "${name}" has defaults`, () => {
      const parsed = yaml.load(yamlStr) as { defaults?: unknown };
      expect(parsed.defaults).toBeDefined();
    });
  }
});

describe('getProfile', () => {
  it('returns YAML string for known profile names', () => {
    expect(getProfile('minimal')).toBe(PROFILES['minimal']);
    expect(getProfile('strict-oss')).toBe(PROFILES['strict-oss']);
    expect(getProfile('security-sensitive')).toBe(PROFILES['security-sensitive']);
  });

  it('returns null for unknown profile names', () => {
    expect(getProfile('nonexistent')).toBeNull();
    expect(getProfile('')).toBeNull();
  });

  it('returned YAML for minimal parses as valid policy', () => {
    const yamlStr = getProfile('minimal');
    expect(yamlStr).not.toBeNull();
    const parsed = yaml.load(yamlStr!);
    expect(() => parsePolicy(parsed)).not.toThrow();
  });

  it('minimal profile allows docs-only changes', () => {
    const parsed = yaml.load(getProfile('minimal')!) as { rules?: Array<{ name: string; effect: string }> };
    const docsRule = parsed.rules?.find((r) => r.name === 'Allow docs-only changes');
    expect(docsRule).toBeDefined();
    expect(docsRule?.effect).toBe('allow');
  });

  it('strict-oss profile blocks sensitive paths', () => {
    const parsed = yaml.load(getProfile('strict-oss')!) as { rules?: Array<{ name: string; effect: string }> };
    const sensitiveRule = parsed.rules?.find((r) => r.name === 'Block sensitive paths');
    expect(sensitiveRule).toBeDefined();
    expect(sensitiveRule?.effect).toBe('block');
  });

  it('security-sensitive profile blocks unknown agents', () => {
    const parsed = yaml.load(getProfile('security-sensitive')!) as { rules?: Array<{ name: string; effect: string }> };
    const blockUnknown = parsed.rules?.find((r) => r.name === 'Block unknown agents');
    expect(blockUnknown).toBeDefined();
    expect(blockUnknown?.effect).toBe('block');
  });

  it('security-sensitive profile default unknown_agent is block', () => {
    const parsed = yaml.load(getProfile('security-sensitive')!) as {
      defaults?: { unknown_agent?: string };
    };
    expect(parsed.defaults?.unknown_agent).toBe('block');
  });
});
