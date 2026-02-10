/**
 * Behavior Parser
 *
 * Parses behavior/trait definitions from domain language.
 * Behaviors define state machines with transitions, guards, and effects.
 * All entity references are explicit (e.g., Order.status, CurrentUser.role).
 */

import type {
  DomainBehavior,
  DomainTransition,
  DomainTick,
  DomainGuard,
  DomainEffect,
  ParseResult,
  ParseError,
} from '../types.js';
import { Lexer } from '../lexer.js';
import { TokenType } from '../tokens.js';
import { parseGuard } from './guard-parser.js';
import { parseDomainEffect, parseDomainGuard } from './sexpr-parser.js';

interface BehaviorParseContext {
  entityName: string;
  errors: ParseError[];
  warnings: ParseError[];
}

/**
 * Parse a behavior definition from domain text
 *
 * @example
 * parseBehavior(`
 *   Order Lifecycle
 *
 *   States: Pending, Confirmed, Shipped, Delivered, Cancelled
 *
 *   Transitions:
 *     - From Pending to Confirmed when CONFIRM
 *       if Order.amount > 0
 *       then notify customer
 *     - From Confirmed to Shipped when SHIP
 *     - From Shipped to Delivered when DELIVER
 *     - From any to Cancelled when CANCEL
 *       if Order.status is not Delivered
 *
 *   Rules:
 *     - Orders over $1000 require manager approval
 *     - Cancelled orders cannot be reactivated
 * `, "Order")
 */
export function parseBehavior(text: string, entityName: string): ParseResult<DomainBehavior> {
  const ctx: BehaviorParseContext = { entityName, errors: [], warnings: [] };
  const lexer = new Lexer(text);
  const tokens = lexer.tokenize();

  let pos = 0;

  // Helper functions
  const current = () => tokens[pos] || { type: TokenType.EOF, value: '', line: 0, column: 0, offset: 0 };
  const advance = () => tokens[pos++];
  const isAtEnd = () => current().type === TokenType.EOF;
  const skip = (type: TokenType) => {
    while (current().type === type) advance();
  };

  // Skip leading whitespace
  skip(TokenType.NEWLINE);

  // Parse behavior name (first line)
  const behaviorName = parseBehaviorName();
  if (!behaviorName) {
    return {
      success: false,
      errors: ctx.errors.length > 0 ? ctx.errors : [{
        message: 'Expected behavior name at start of definition',
      }],
      warnings: [],
    };
  }

  const behavior: DomainBehavior = {
    type: 'behavior',
    name: behaviorName,
    entityName,
    states: [],
    initialState: '',
    transitions: [],
    ticks: [],
    rules: [],
  };

  skip(TokenType.NEWLINE);

  // Parse remaining sections
  while (!isAtEnd()) {
    skip(TokenType.NEWLINE);
    if (isAtEnd()) break;

    const parsed = parseBehaviorSection(behavior);
    if (!parsed) {
      advance();
    }
  }

  // Set initial state if not specified
  if (!behavior.initialState && behavior.states.length > 0) {
    behavior.initialState = behavior.states[0];
  }

  return {
    success: true,
    data: behavior,
    errors: ctx.errors,
    warnings: ctx.warnings,
  };

  // === Helper Functions ===

  function parseBehaviorName(): string | null {
    const nameParts: string[] = [];

    while (!isAtEnd() && current().type !== TokenType.NEWLINE) {
      // Check for "Entity:" section - extract entity name
      if (current().type === TokenType.IDENTIFIER && current().value.toLowerCase() === 'entity') {
        advance(); // skip "Entity"
        if (current().type === TokenType.COLON) {
          advance(); // skip ":"
          // Next identifier is the entity name
          if (current().type === TokenType.IDENTIFIER) {
            ctx.entityName = current().value;
            advance();
          }
        }
        continue;
      }

      // Skip parentheses (for syntax like "behavior (Entity: X)")
      if (current().type === TokenType.LPAREN || current().type === TokenType.RPAREN) {
        advance();
        continue;
      }

      // Collect identifiers, lifecycle keywords, and AUTO keyword (for names like "Auto Save")
      // Skip "behavior" keyword and colon
      if (current().type === TokenType.IDENTIFIER ||
          current().type === TokenType.LIFECYCLE ||
          current().type === TokenType.AUTO) {
        nameParts.push(current().value);
      }
      // Skip the "behavior" keyword (don't include it in the name)
      // Also skip colon
      advance();
    }

    if (nameParts.length === 0) {
      return null;
    }

    return nameParts.join(' ');
  }

  function parseBehaviorSection(behavior: DomainBehavior): boolean {
    const token = current();

    // "Entity: [entityName]" - explicit entity association
    if (token.type === TokenType.IDENTIFIER && token.value.toLowerCase() === 'entity') {
      advance();
      skip(TokenType.COLON);
      if (current().type === TokenType.IDENTIFIER) {
        ctx.entityName = current().value;
        behavior.entityName = current().value;
        advance();
      }
      return true;
    }

    // "States: [state1], [state2], ..."
    if (token.type === TokenType.STATES) {
      advance();
      skip(TokenType.COLON);
      parseStatesLine(behavior);
      return true;
    }

    // "Initial: [state]"
    if (token.type === TokenType.INITIAL) {
      advance();
      skip(TokenType.COLON);
      if (current().type === TokenType.IDENTIFIER) {
        behavior.initialState = current().value;
        advance();
      }
      return true;
    }

    // "Transitions:"
    if (token.type === TokenType.TRANSITIONS) {
      advance();
      skip(TokenType.COLON);
      skip(TokenType.NEWLINE);
      parseTransitionsSection(behavior);
      return true;
    }

    // "Rules:"
    if (token.type === TokenType.RULES) {
      advance();
      skip(TokenType.COLON);
      skip(TokenType.NEWLINE);
      parseRulesSection(behavior);
      return true;
    }

    // "Every [interval]:" - ticks
    if (token.type === TokenType.EVERY) {
      advance();
      parseTick(behavior);
      return true;
    }

    // "Lifecycle" keyword at section level
    if (token.type === TokenType.LIFECYCLE) {
      advance();
      return true;
    }

    return false;
  }

  function parseStatesLine(behavior: DomainBehavior): void {
    const states: string[] = [];

    while (!isAtEnd() && current().type !== TokenType.NEWLINE) {
      if (current().type === TokenType.IDENTIFIER) {
        states.push(current().value);
      }
      advance();
    }

    behavior.states = states;
  }

  function parseTransitionsSection(behavior: DomainBehavior): void {
    // Check for INDENT
    if (current().type === TokenType.INDENT) {
      advance();

      while (!isAtEnd() && current().type !== TokenType.DEDENT) {
        skip(TokenType.NEWLINE);
        if (current().type === TokenType.DEDENT) break;

        // Only try to parse if we see DASH or FROM (transition markers)
        if (current().type === TokenType.DASH ||
            current().type === TokenType.FROM) {
          const transition = parseTransitionLine();
          if (transition) {
            behavior.transitions.push(transition);
          }
        } else {
          // Skip unrecognized content (e.g., "filter" effects that aren't standard)
          // Advance to next line to avoid infinite loop
          while (!isAtEnd() &&
                 current().type !== TokenType.NEWLINE &&
                 current().type !== TokenType.DEDENT) {
            advance();
          }
        }
      }

      if (current().type === TokenType.DEDENT) {
        advance();
      }
    } else {
      // Parse inline transitions (non-indented)
      while (!isAtEnd() &&
             current().type !== TokenType.RULES &&
             current().type !== TokenType.EVERY) {
        skip(TokenType.NEWLINE);
        if (current().type === TokenType.RULES ||
            current().type === TokenType.EVERY ||
            isAtEnd()) break;

        if (current().type === TokenType.DASH ||
            current().type === TokenType.FROM) {
          const transition = parseTransitionLine();
          if (transition) {
            behavior.transitions.push(transition);
          }
        } else {
          advance();
        }
      }
    }
  }

  function parseTransitionLine(): DomainTransition | null {
    // Skip dash if present
    if (current().type === TokenType.DASH) {
      advance();
    }

    // Expect "From"
    if (current().type !== TokenType.FROM) {
      return null;
    }
    advance();

    // Get "from" state
    let fromState = '';
    if (current().type === TokenType.IDENTIFIER) {
      fromState = current().value;
      advance();
    }

    // Handle "any" as wildcard
    if (fromState.toLowerCase() === 'any') {
      fromState = '*';
    }

    // Expect "to"
    if (current().type !== TokenType.TO) {
      ctx.errors.push({ message: `Expected "to" in transition from "${fromState}"` });
      return null;
    }
    advance();

    // Get "to" state
    let toState = '';
    if (current().type === TokenType.IDENTIFIER) {
      toState = current().value;
      advance();
    }

    // Expect "when" for event
    let event = '';
    if (current().type === TokenType.WHEN) {
      advance();
      if (current().type === TokenType.IDENTIFIER) {
        event = current().value;
        advance();
      }
    }

    const transition: DomainTransition = {
      type: 'transition',
      fromState,
      toState,
      event: event.toUpperCase(),
      guards: [],
      effects: [],
    };

    skip(TokenType.NEWLINE);

    // Parse optional guard ("if ...")
    if (current().type === TokenType.INDENT) {
      advance();

      while (!isAtEnd() && current().type !== TokenType.DEDENT) {
        skip(TokenType.NEWLINE);
        if (current().type === TokenType.DEDENT) break;

        // "if [condition]"
        if (current().type === TokenType.IF) {
          const guardText = collectLine();
          const guardResult = parseGuard(guardText, entityName);
          if (guardResult.success && guardResult.data) {
            transition.guards.push(guardResult.data);
          }
          continue;
        }

        // "then [effect]"
        if (current().type === TokenType.THEN) {
          advance();
          const effectText = collectUntilNewline();
          const effect = parseEffectText(effectText);
          if (effect) {
            transition.effects.push(effect);
          }
          continue;
        }

        // Skip any other token to prevent infinite loop
        if (current().type !== TokenType.NEWLINE && current().type !== TokenType.DEDENT) {
          advance();
        }

        skip(TokenType.NEWLINE);
      }

      if (current().type === TokenType.DEDENT) {
        advance();
      }
    } else {
      // Check for inline "if" on same line
      if (current().type === TokenType.IF) {
        const guardText = collectLine();
        const guardResult = parseGuard(guardText, entityName);
        if (guardResult.success && guardResult.data) {
          transition.guards.push(guardResult.data);
        }
      }
    }

    return transition;
  }

  function parseRulesSection(behavior: DomainBehavior): void {
    if (current().type === TokenType.INDENT) {
      advance();

      while (!isAtEnd() && current().type !== TokenType.DEDENT) {
        skip(TokenType.NEWLINE);
        if (current().type === TokenType.DEDENT) break;

        // Skip dash
        if (current().type === TokenType.DASH) {
          advance();
        }

        const rule = collectUntilNewline();
        if (rule) {
          behavior.rules.push(rule);
        }

        skip(TokenType.NEWLINE);
      }

      if (current().type === TokenType.DEDENT) {
        advance();
      }
    }
  }

  function parseTick(behavior: DomainBehavior): void {
    // Collect interval specification
    const intervalParts: string[] = [];
    while (!isAtEnd() &&
           current().type !== TokenType.COLON &&
           current().type !== TokenType.NEWLINE) {
      intervalParts.push(current().value);
      advance();
    }

    const interval = intervalParts.join(' ');

    skip(TokenType.COLON);
    skip(TokenType.NEWLINE);

    const tick: DomainTick = {
      type: 'tick',
      name: `tick_${interval.replace(/\s+/g, '_').toLowerCase()}`,
      interval,
      intervalMs: parseInterval(interval),
      effects: [],
    };

    // Parse tick body (guard and effects)
    if (current().type === TokenType.INDENT) {
      advance();

      while (!isAtEnd() && current().type !== TokenType.DEDENT) {
        skip(TokenType.NEWLINE);
        if (current().type === TokenType.DEDENT) break;

        // "if [condition]" - guard
        if (current().type === TokenType.IF) {
          const guardText = collectLine();
          const guardResult = parseGuard(guardText, entityName);
          if (guardResult.success && guardResult.data) {
            tick.guard = guardResult.data;
          }
        }

        // "then [effect]" or "[effect]"
        if (current().type === TokenType.THEN) {
          advance();
        }

        if (current().type === TokenType.DASH) {
          advance();
        }

        const effectText = collectUntilNewline();
        if (effectText && current().type !== TokenType.IF) {
          const effect = parseEffectText(effectText);
          if (effect) {
            tick.effects.push(effect);
          }
        }

        skip(TokenType.NEWLINE);
      }

      if (current().type === TokenType.DEDENT) {
        advance();
      }
    }

    behavior.ticks.push(tick);
  }

  function collectLine(): string {
    return collectTokensSmartJoin();
  }

  function collectUntilNewline(): string {
    return collectTokensSmartJoin();
  }

  /**
   * Collect tokens and join them smartly - no spaces around dashes/dots
   * to preserve patterns like "page-header" and "entity.field"
   *
   * When insideArray is detected (starts with [), STRING tokens are quoted
   * to preserve valid JSON for S-expression parsing.
   */
  function collectTokensSmartJoin(): string {
    const parts: { value: string; type: TokenType }[] = [];
    while (!isAtEnd() && current().type !== TokenType.NEWLINE) {
      parts.push({ value: current().value, type: current().type });
      advance();
    }

    // Check if this looks like an S-expression (starts with [)
    // If so, we need to quote STRING tokens to preserve valid JSON
    const startsWithBracket = parts.length > 0 && parts[0].type === TokenType.LBRACKET;

    // Smart join: no spaces before/after DASH, DOT, or brackets
    let result = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const prev = parts[i - 1];

      // Don't add space before dash, dot, comma, colon, or closing brackets
      const noSpaceBefore = part.type === TokenType.DASH ||
                            part.type === TokenType.DOT ||
                            part.type === TokenType.COMMA ||
                            part.type === TokenType.COLON ||
                            part.type === TokenType.RBRACKET ||
                            part.type === TokenType.RPAREN;

      // Don't add space after dash, dot, or open brackets
      const prevNoSpaceAfter = prev &&
                               (prev.type === TokenType.DASH ||
                                prev.type === TokenType.DOT ||
                                prev.type === TokenType.LBRACKET ||
                                prev.type === TokenType.LPAREN);

      if (i > 0 && !noSpaceBefore && !prevNoSpaceAfter) {
        result += ' ';
      }

      // Quote STRING tokens if we're inside an S-expression to preserve valid JSON
      if (startsWithBracket && part.type === TokenType.STRING) {
        result += `"${part.value}"`;
      } else {
        result += part.value;
      }
    }

    return result.trim();
  }

  function parseEffectText(text: string): DomainEffect | null {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // First, check if this is a raw S-expression (JSON array like ["render-ui", ...])
    // Domain text from LLM may contain S-expressions directly
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const effectOp = String(parsed[0]);
          // Return with effectType from first element
          // Keep the raw JSON in description - formatBehaviorToSchema will handle it
          // Cast to DomainEffect['effectType'] since we're parsing dynamic LLM content
          return {
            type: 'effect',
            effectType: effectOp as DomainEffect['effectType'],
            description: trimmed,
            config: { _rawSExpr: parsed }, // Store parsed S-expression
          };
        }
      } catch {
        // Not valid JSON, fall through to other handlers
      }
    }

    // "persist [action] [entity]" - persist effect
    const persistMatch = text.match(/^persist\s+(\w+)(?:\s+(\w+))?$/i);
    if (persistMatch) {
      return {
        type: 'effect',
        effectType: 'persist',
        description: text,
        config: {
          dataAction: persistMatch[1].toLowerCase(),
          entity: persistMatch[2] || undefined,
        },
      };
    }

    // "send_in_app to [userId] title [title] message [message] type [type]" - notify effect
    const sendInAppMatch = text.match(/^send_in_app\s+to\s+(.+?)\s+title\s+"([^"]+)"\s+message\s+"([^"]+)"(?:\s+type\s+(\w+))?$/i);
    if (sendInAppMatch) {
      return {
        type: 'effect',
        effectType: 'notify',
        description: text,
        config: {
          userId: sendInAppMatch[1],
          title: sendInAppMatch[2],
          message: sendInAppMatch[3],
          type: sendInAppMatch[4] || 'info',
        },
      };
    }

    // Generic JSON config format: "effectType:{...json...}"
    const jsonMatch = text.match(/^(\w+):(\{.+\})$/);
    if (jsonMatch) {
      try {
        const config = JSON.parse(jsonMatch[2]);
        return {
          type: 'effect',
          effectType: jsonMatch[1] as any,
          description: text,
          config,
        };
      } catch {
        // Fall through to other handlers
      }
    }

    // "notify [recipient] [message]" - notify with recipient
    const notifyWithRecipientMatch = text.match(/^notify\s+(\S+)\s+"([^"]+)"$/i);
    if (notifyWithRecipientMatch) {
      return {
        type: 'effect',
        effectType: 'notify',
        description: text,
        config: {
          recipient: notifyWithRecipientMatch[1],
          message: notifyWithRecipientMatch[2],
        },
      };
    }

    // "notify [target]"
    if (lower.startsWith('notify')) {
      const remaining = text.slice(6).trim();
      // Check if it's a quoted message
      const quotedMatch = remaining.match(/^"([^"]+)"$/);
      return {
        type: 'effect',
        effectType: 'notify',
        description: text,
        config: {
          message: quotedMatch ? quotedMatch[1] : remaining,
        },
      };
    }

    // "update [field] to [value]" - set effect
    const updateMatch = text.match(/^update\s+(.+?)\s+to\s+(.+)$/i);
    if (updateMatch) {
      return {
        type: 'effect',
        effectType: 'set',
        description: text,
        config: {
          field: preserveTemplateVars(updateMatch[1]),
          value: updateMatch[2],
        },
      };
    }

    // "navigate to [path]"
    const navMatch = text.match(/^navigate\s+to\s+(.+)$/i);
    if (navMatch) {
      return {
        type: 'effect',
        effectType: 'navigate',
        description: text,
        config: {
          path: navMatch[1],
        },
      };
    }

    // "emit [event]" - emit effect
    const emitMatch = text.match(/^emit\s+(.+)$/i);
    if (emitMatch) {
      return {
        type: 'effect',
        effectType: 'emit',
        description: text,
        config: {
          eventKey: emitMatch[1].toUpperCase().replace(/\s+/g, '_'),
        },
      };
    }

    // "call [endpoint]" - call-service effect
    const callMatch = text.match(/^call\s+(.+)$/i);
    if (callMatch) {
      return {
        type: 'effect',
        effectType: 'call-service',
        description: text,
        config: {
          service: callMatch[1],
        },
      };
    }

    // "render [pattern] to [slot]" - render-ui effect (delegate to S-expression parser)
    if (lower.startsWith('render ')) {
      // This is a render effect - delegate to sexpr-parser for proper handling
      // Note: the sexpr-parser will validate the pattern type
      try {
        const result = parseDomainEffect(text);
        if (Array.isArray(result) && result[0] === 'render-ui') {
          return {
            type: 'effect',
            effectType: 'render-ui',
            description: text,
            config: {
              slot: result[1] as string,
              pattern: result[2] as Record<string, unknown>,
            },
          };
        }
      } catch {
        // Fall through to unknown effect warning
      }
    }

    // Unknown effect - warn and return null instead of silently converting to notify
    // This prevents masking of invalid effects that should be caught during validation
    ctx.warnings.push({
      message: `Unknown effect syntax: "${text}". Effect will be ignored. Use a valid effect format like "update X to Y", "emit EVENT", "navigate to /path", "notify 'message'", or "render pattern to slot".`,
    });
    return null;
  }

  function parseInterval(text: string): number {
    const lower = text.toLowerCase();

    // Match patterns like "30 seconds", "1 hour", "5 minutes"
    const match = lower.match(/(\d+)\s*(second|minute|hour|day|week)s?/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];

      switch (unit) {
        case 'second': return value * 1000;
        case 'minute': return value * 60 * 1000;
        case 'hour': return value * 60 * 60 * 1000;
        case 'day': return value * 24 * 60 * 60 * 1000;
        case 'week': return value * 7 * 24 * 60 * 60 * 1000;
      }
    }

    // Default to 1 hour
    return 60 * 60 * 1000;
  }
}

/**
 * Format a behavior AST back to domain text
 */
export function formatBehaviorToDomain(behavior: DomainBehavior): string {
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
 * Format behavior AST to KFlow schema trait
 */
export function formatBehaviorToSchema(behavior: DomainBehavior): Record<string, unknown> {
  const trait: Record<string, unknown> = {
    // Just remove spaces, preserve the casing from the source
    // Trust the LLM/author to use consistent PascalCase naming
    name: behavior.name.replace(/\s+/g, ''),
    description: behavior.name,
  };

  // Only include stateMachine if there are states
  if (behavior.states.length > 0) {
    trait.stateMachine = {
      states: behavior.states.map((state, index) => ({
        name: state,
        isInitial: state === behavior.initialState || (index === 0 && !behavior.initialState),
      })),
      events: extractEventsFromTransitions(behavior.transitions),
      transitions: behavior.transitions.map(t => {
        const transition: Record<string, unknown> = {
          from: t.fromState,
          to: t.toState,
          event: t.event,
        };

        // Only include guard if present - convert to S-Expression
        if (t.guards.length > 0) {
          // Convert guards to S-Expressions
          const guardExprs = t.guards.map(g => {
            // Use the raw text to parse to S-Expression
            if (g.raw) {
              return parseDomainGuard(g.raw, behavior.entityName);
            }
            return parseDomainGuard(formatGuardToCondition(g), behavior.entityName);
          });
          // Combine multiple guards with AND
          transition.guard = guardExprs.length === 1
            ? guardExprs[0]
            : ['and', ...guardExprs];
        }

        // Only include effects if present - convert to S-Expressions
        if (t.effects.length > 0) {
          transition.effects = t.effects.map(e => {
            // If effect has pre-parsed S-expression (from raw JSON in domain text), use it directly
            if (e.config && '_rawSExpr' in e.config && Array.isArray(e.config._rawSExpr)) {
              return e.config._rawSExpr;
            }
            // Otherwise, parse the description text to S-Expression
            return parseDomainEffect(e.description, behavior.entityName);
          });
        }

        return transition;
      }),
    };
  }

  // Only include ticks if there are any - convert to S-Expressions
  if (behavior.ticks.length > 0) {
    trait.ticks = behavior.ticks.map(t => ({
      name: toPascalCase(t.name.replace(/\s+/g, '')),
      interval: t.intervalMs, // Direct number in ms
      guard: t.guard
        ? parseDomainGuard(t.guard.raw || formatGuardToCondition(t.guard), behavior.entityName)
        : undefined,
      effects: t.effects.map(e => {
        // If effect has pre-parsed S-expression (from raw JSON in domain text), use it directly
        if (e.config && '_rawSExpr' in e.config && Array.isArray(e.config._rawSExpr)) {
          return e.config._rawSExpr;
        }
        // Otherwise, parse the description text to S-Expression
        return parseDomainEffect(e.description, behavior.entityName);
      }),
    }));
  }

  return trait;
}

// === Utility Functions ===

function toCamelCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) =>
      index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join('');
}

function toPascalCase(text: string): string {
  // If no spaces, the text is likely already PascalCase (e.g., "TraineeManager")
  // Just ensure first letter is uppercase and preserve the rest
  if (!text.includes(' ')) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  // If has spaces, convert each word: "trainee manager" -> "TraineeManager"
  return text
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function extractEventsFromTransitions(transitions: DomainTransition[]): { key: string; name: string }[] {
  const events = new Map<string, string>();

  for (const t of transitions) {
    if (t.event && !events.has(t.event)) {
      events.set(t.event, toTitleCase(t.event.replace(/_/g, ' ')));
    }
  }

  return Array.from(events.entries()).map(([key, name]) => ({ key, name }));
}

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatGuardForDomain(guard: DomainGuard): string {
  return guard.raw || 'if condition';
}

function formatGuardToCondition(guard: DomainGuard): string {
  // Use the raw text if available, otherwise reconstruct
  if (guard.raw) {
    // Strip "if " prefix if present
    return guard.raw.replace(/^if\s+/i, '');
  }
  return 'true';
}

/**
 * Preserve template variables like {linkedEntity} while converting the rest to camelCase
 * Input: "{linkedEntity}.status" -> "{linkedEntity}.status"
 * Input: "entity . status" -> "entity.status" (preserve dot paths)
 * Input: "entity status" -> "entityStatus" (convert spaces to camelCase)
 */
function preserveTemplateVars(text: string): string {
  // If it contains template syntax {xxx}, preserve it
  if (text.includes('{') && text.includes('}')) {
    // Just clean up whitespace around dots
    return text.replace(/\s*\.\s*/g, '.');
  }

  // Check if this is a dot-separated path (like "entity . status" from token reconstruction)
  // Clean up whitespace around dots first
  const cleanedText = text.replace(/\s*\.\s*/g, '.');

  // If it's a dot path (like "entity.status" or "entity.fieldName"), preserve it as-is
  if (cleanedText.includes('.')) {
    return cleanedText;
  }

  // Otherwise convert spaces to camelCase
  return toCamelCase(text);
}
