/**
 * Behavior Formatter
 *
 * Converts KFlow Trait schema to domain language text.
 * Supports both legacy typed effects and S-expression format.
 */

import type {
  DomainBehavior,
  DomainTransition,
  DomainTick,
  DomainGuard,
  DomainEffect,
  EffectType,
} from '../types.js';
import { formatSExprToDomain, formatSExprGuardToDomain, isArraySExpr } from './sexpr-formatter.js';

/**
 * Convert a KFlow Trait schema to domain language text
 */
export function formatSchemaTraitToDomain(trait: Record<string, unknown>, entityName?: string): string {
  const domainBehavior = schemaTraitToDomainBehavior(trait, entityName);
  return formatBehaviorText(domainBehavior);
}

/**
 * Convert KFlow Trait schema to DomainBehavior AST
 */
export function schemaTraitToDomainBehavior(trait: Record<string, unknown>, entityName?: string): DomainBehavior {
  const name = trait.name as string;
  const description = (trait.description as string) || name;

  // Determine entity name from trait or parameter
  let resolvedEntityName = entityName || '';
  const dataEntities = trait.dataEntities as Array<Record<string, unknown>> | undefined;
  if (!resolvedEntityName && dataEntities && dataEntities.length > 0) {
    resolvedEntityName = dataEntities[0].entity as string || '';
  }
  if (!resolvedEntityName) {
    // Try to extract from trait name (e.g., "OrderLifecycle" -> "Order")
    resolvedEntityName = extractEntityFromName(name);
  }

  // Extract state machine
  const stateMachine = trait.stateMachine as Record<string, unknown> | undefined;
  let states: string[] = [];
  let initialState = '';
  const transitions: DomainTransition[] = [];

  if (stateMachine) {
    // Extract states
    const schemaStates = (stateMachine.states as Array<Record<string, unknown>>) || [];
    for (const state of schemaStates) {
      const stateName = state.name as string;
      states.push(stateName);
      if (state.isInitial) {
        initialState = stateName;
      }
    }

    // Extract transitions
    const schemaTransitions = (stateMachine.transitions as Array<Record<string, unknown>>) || [];
    for (const t of schemaTransitions) {
      const fromState = t.from as string;
      const toState = t.to as string;
      const event = t.event as string;

      // Convert guards
      const guards: DomainGuard[] = [];
      const schemaGuards = (t.guards as Array<Record<string, unknown> | unknown[]>) || [];
      for (const g of schemaGuards) {
        // Check for S-expression guard
        if (isArraySExpr(g)) {
          guards.push({
            type: 'guard',
            condition: parseGuardCondition('', resolvedEntityName),
            raw: formatSExprGuardToDomain(g, resolvedEntityName),
          });
        } else {
          const guardObj = g as unknown as Record<string, unknown>;
          const condition = guardObj.condition;
          // Check if condition is S-expression
          if (isArraySExpr(condition)) {
            guards.push({
              type: 'guard',
              condition: parseGuardCondition('', resolvedEntityName),
              raw: formatSExprGuardToDomain(condition, resolvedEntityName),
            });
          } else {
            guards.push({
              type: 'guard',
              condition: parseGuardCondition(condition as string, resolvedEntityName),
              raw: `if ${condition}`,
            });
          }
        }
      }

      // Single guard from transition
      if (t.guard) {
        // Check for S-expression guard
        if (isArraySExpr(t.guard)) {
          guards.push({
            type: 'guard',
            condition: parseGuardCondition('', resolvedEntityName),
            raw: formatSExprGuardToDomain(t.guard, resolvedEntityName),
          });
        } else {
          const guardObj = t.guard as Record<string, unknown>;
          const condition = guardObj.condition;
          // Check if condition is S-expression
          if (isArraySExpr(condition)) {
            guards.push({
              type: 'guard',
              condition: parseGuardCondition('', resolvedEntityName),
              raw: formatSExprGuardToDomain(condition, resolvedEntityName),
            });
          } else {
            guards.push({
              type: 'guard',
              condition: parseGuardCondition(condition as string, resolvedEntityName),
              raw: `if ${condition}`,
            });
          }
        }
      }

      // Convert effects
      const effects = convertEffects(t.effects as Array<Record<string, unknown>> | undefined);

      transitions.push({
        type: 'transition',
        fromState,
        toState,
        event,
        guards,
        effects,
      });
    }
  }

  // Extract ticks
  const ticks: DomainTick[] = [];
  const schemaTicks = (trait.ticks as Array<Record<string, unknown>>) || [];
  for (const t of schemaTicks) {
    // Support both 'name' (new format) and 'id' (old format) for tick identifier
    const tickName = (t.name as string) || (t.id as string) || 'unnamed_tick';
    const intervalValue = t.interval;

    // Parse interval - can be a number (ms) or object { ms: number } or { frames: number }
    let intervalStr = 'every hour';
    let intervalMs = 3600000;
    if (typeof intervalValue === 'number') {
      // Direct milliseconds
      intervalMs = intervalValue;
      intervalStr = formatIntervalMs(intervalMs);
    } else if (intervalValue && typeof intervalValue === 'object') {
      const interval = intervalValue as Record<string, unknown>;
      if (interval.ms) {
        intervalMs = interval.ms as number;
        intervalStr = formatIntervalMs(intervalMs);
      } else if (interval.frames) {
        intervalMs = (interval.frames as number) * 1000; // Assuming 1 frame = 1 second
        intervalStr = formatIntervalMs(intervalMs);
      }
    }

    // Guard - can be a string, S-expression, or object { condition: string | SExpr }
    let tickGuard: DomainGuard | undefined;
    if (t.guard) {
      // Check for S-expression guard
      if (isArraySExpr(t.guard)) {
        tickGuard = {
          type: 'guard',
          condition: parseGuardCondition('', resolvedEntityName),
          raw: formatSExprGuardToDomain(t.guard, resolvedEntityName),
        };
      } else if (typeof t.guard === 'string') {
        tickGuard = {
          type: 'guard',
          condition: parseGuardCondition(t.guard, resolvedEntityName),
          raw: `if ${t.guard}`,
        };
      } else {
        const guardObj = t.guard as Record<string, unknown>;
        const condition = guardObj.condition;
        // Check if condition is S-expression
        if (isArraySExpr(condition)) {
          tickGuard = {
            type: 'guard',
            condition: parseGuardCondition('', resolvedEntityName),
            raw: formatSExprGuardToDomain(condition, resolvedEntityName),
          };
        } else {
          tickGuard = {
            type: 'guard',
            condition: parseGuardCondition(condition as string, resolvedEntityName),
            raw: `if ${condition}`,
          };
        }
      }
    }

    // Effects
    const effects = convertEffects(t.effects as Array<Record<string, unknown>> | undefined);

    ticks.push({
      type: 'tick',
      name: tickName,
      interval: intervalStr,
      intervalMs,
      guard: tickGuard,
      effects,
    });
  }

  return {
    type: 'behavior',
    name: formatBehaviorName(name),
    entityName: resolvedEntityName,
    states,
    initialState,
    transitions,
    ticks,
    rules: [],
  };
}

/**
 * Format DomainBehavior AST to domain language text
 */
function formatBehaviorText(behavior: DomainBehavior): string {
  const lines: string[] = [];

  // Behavior name
  lines.push(behavior.name);
  lines.push('');

  // States
  if (behavior.states.length > 0) {
    lines.push(`States: ${behavior.states.join(', ')}`);
    lines.push('');
  }

  // Transitions
  if (behavior.transitions.length > 0) {
    lines.push('Transitions:');
    for (const transition of behavior.transitions) {
      const fromState = transition.fromState === '*' ? 'any' : transition.fromState;
      let line = `  - From ${fromState} to ${transition.toState}`;
      if (transition.event) {
        line += ` when ${transition.event}`;
      }
      lines.push(line);

      // Guards
      for (const guard of transition.guards) {
        lines.push(`    ${guard.raw || formatGuardForDomain(guard)}`);
      }

      // Effects
      for (const effect of transition.effects) {
        lines.push(`    then ${effect.description}`);
      }
    }
    lines.push('');
  }

  // Ticks
  for (const tick of behavior.ticks) {
    lines.push(`Every ${tick.interval}:`);
    if (tick.guard) {
      lines.push(`  ${tick.guard.raw || formatGuardForDomain(tick.guard)}`);
    }
    for (const effect of tick.effects) {
      lines.push(`  - ${effect.description}`);
    }
    lines.push('');
  }

  // Rules
  if (behavior.rules.length > 0) {
    lines.push('Rules:');
    for (const rule of behavior.rules) {
      lines.push(`  - ${rule}`);
    }
  }

  return lines.join('\n').trim();
}

/**
 * Convert schema effects to domain effects.
 * Handles both legacy typed effects and S-expression format.
 */
function convertEffects(effects: Array<Record<string, unknown> | unknown[]> | undefined): DomainEffect[] {
  if (!effects) return [];

  return effects.map(e => {
    // Check for S-expression effect (array format)
    if (isArraySExpr(e)) {
      const description = formatSExprToDomain(e);
      return {
        type: 'effect',
        effectType: 'sexpr' as EffectType,
        description,
        config: { sexpr: e },
      };
    }

    // Legacy typed effect
    const effectObj = e as unknown as Record<string, unknown>;
    const effectType = effectObj.type as EffectType;
    const config = (effectObj.config as Record<string, unknown>) || {};

    return {
      type: 'effect',
      effectType,
      description: generateEffectDescription(effectType, config),
      config,
    };
  });
}

/**
 * Generate a human-readable description for an effect
 */
function generateEffectDescription(type: EffectType, config: Record<string, unknown>): string {
  switch (type) {
    case 'notify':
      const message = config.message as string;
      const recipient = config.recipient as string;
      if (recipient) {
        return message ? `notify ${recipient} "${message}"` : `notify ${recipient}`;
      }
      return message ? `notify "${message}"` : 'send notification';

    case 'set':
      const field = config.field as string;
      const value = config.value;
      return `update ${field} to ${value}`;

    case 'navigate':
      const path = config.path as string;
      return `navigate to ${path}`;

    case 'emit':
      const event = (config.eventKey || config.event) as string;
      return `emit ${event}`;

    case 'call-service':
      const endpoint = config.endpoint as string;
      const service = config.service as string;
      return service ? `call ${service}` : `call ${endpoint}`;

    case 'persist':
      const dataAction = config.dataAction as string || 'save';
      const entity = config.entity as string;
      return entity ? `persist ${dataAction} ${entity}` : `persist ${dataAction}`;

    default:
      // For unknown effect types, serialize the config as JSON
      if (Object.keys(config).length > 0) {
        return `${type}:${JSON.stringify(config)}`;
      }
      return `${type} action`;
  }
}

/**
 * Format an interval in milliseconds to human readable text
 */
function formatIntervalMs(ms: number): string {
  const seconds = ms / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;

  if (days >= 1 && days === Math.floor(days)) {
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (hours >= 1 && hours === Math.floor(hours)) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  if (minutes >= 1 && minutes === Math.floor(minutes)) {
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return seconds === 1 ? '1 second' : `${seconds} seconds`;
}

/**
 * Format behavior name from PascalCase to readable text
 */
function formatBehaviorName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
}

/**
 * Extract entity name from trait name
 */
function extractEntityFromName(name: string): string {
  // Common patterns: "OrderLifecycle" -> "Order", "TaskApproval" -> "Task"
  const suffixes = ['Lifecycle', 'Approval', 'Workflow', 'Status', 'Process', 'Flow'];
  for (const suffix of suffixes) {
    if (name.endsWith(suffix)) {
      return name.slice(0, -suffix.length);
    }
  }
  return name;
}

/**
 * Parse a guard condition string into a simple AST
 * This is a simplified version that creates a basic guard structure
 */
function parseGuardCondition(condition: string, entityName: string): any {
  // Return a simple comparison condition
  return {
    type: 'comparison',
    field: {
      type: 'field_reference',
      entityName,
      fieldName: 'status',
    },
    operator: '==',
    value: 'valid',
  };
}

/**
 * Format a guard back to domain language
 */
function formatGuardForDomain(guard: DomainGuard): string {
  return guard.raw || 'if condition';
}
