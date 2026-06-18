/**
 * High-level evaluatePolicy wrapper that accepts a simplified input shape
 * matching the integration test contract: { policy, changedFiles, event }.
 */
import type { AgentOwnersPolicy, Decision } from './types.js';
import { classifyFiles } from './classifier.js';
import { detectAgent } from './detection.js';
import { evaluatePolicy as _evaluatePolicy } from './evaluator.js';

export type Policy = AgentOwnersPolicy;

export type EventContext = {
  eventType: string;
  actor: string;
  prTitle?: string;
  prBody?: string;
  labels?: string[];
};

export type { Decision };

export type EvaluatePolicyInput = {
  policy: Policy;
  changedFiles: string[];
  event: EventContext;
};

export function evaluatePolicy(input: EvaluatePolicyInput): Decision {
  const { policy, changedFiles, event } = input;

  const filesClassification = classifyFiles(changedFiles);

  const agentDetection = detectAgent({
    actor: event.actor,
    policy,
    prTitle: event.prTitle,
    prBody: event.prBody,
    labels: event.labels,
  });

  return _evaluatePolicy({
    policy,
    agentDetection,
    detectedActions: [],
    changedFiles,
    filesClassification,
    actor: event.actor,
    prTitle: event.prTitle,
    prBody: event.prBody,
    labels: event.labels,
  });
}
