/**
 * Domain Language Reference — pure function that generates reference docs from the type registry.
 *
 * Separated from generate-docs.ts (CLI script) so it can be compiled and exported.
 */

import {
    FIELD_TYPE_REGISTRY,
    EFFECT_REGISTRY,
    GUARD_REGISTRY,
    UI_SLOTS,
    getRegistryStats,
} from './registry.js';

/**
 * Generate the complete Domain Language reference document as a string.
 */
export function generateDomainLanguageReference(): string {
    const lines: string[] = [];
    const stats = getRegistryStats();

    // Header
    lines.push('# Domain Language Reference');
    lines.push('');
    lines.push('> Auto-generated from type registry');
    lines.push(`> Last updated: ${new Date().toISOString().split('T')[0]}`);
    lines.push('');
    lines.push('This document describes the Domain Language syntax that maps to OrbitalSchema.');
    lines.push('Domain Language is a human-readable format that is converted to/from OrbitalSchema JSON.');
    lines.push('');

    // Table of Contents
    lines.push('## Table of Contents');
    lines.push('');
    lines.push('- [Field Types](#field-types)');
    lines.push('- [Effects](#effects)');
    lines.push('- [Guards](#guards)');
    lines.push('- [UI Slots](#ui-slots)');
    lines.push('- [Bindings](#bindings)');
    lines.push('- [Statistics](#statistics)');
    lines.push('');

    // Field Types
    lines.push('## Field Types');
    lines.push('');
    lines.push('| Schema Type | Domain Keywords | Description |');
    lines.push('|-------------|-----------------|-------------|');
    for (const [type, mapping] of Object.entries(FIELD_TYPE_REGISTRY)) {
        const keywords = mapping.domainKeywords.map(k => `\`${k}\``).join(', ');
        lines.push(`| \`${type}\` | ${keywords} | - |`);
    }
    lines.push('');

    // Effects
    lines.push('## Effects');
    lines.push('');
    lines.push('Effects are actions that occur during state transitions.');
    lines.push('In Domain Language, they are written as human-readable statements.');
    lines.push('The `domain:to-schema` converter translates them to S-Expression arrays.');
    lines.push('');
    lines.push('| Operator | Domain Patterns | Description |');
    lines.push('|----------|-----------------|-------------|');
    for (const [op, mapping] of Object.entries(EFFECT_REGISTRY)) {
        const patterns = mapping.domainPatterns.map(p => `\`${p}\``).join(', ');
        lines.push(`| \`${op}\` | ${patterns} | ${mapping.description} |`);
    }
    lines.push('');

    // Effect Examples
    lines.push('### Effect Examples');
    lines.push('');
    lines.push('```');
    lines.push('# Update a field');
    lines.push('then update status to \'done\'');
    lines.push('');
    lines.push('# Emit an event');
    lines.push('then emit TASK_COMPLETED');
    lines.push('then emit ORDER_PLACED with orderId');
    lines.push('');
    lines.push('# Render UI');
    lines.push('then render entity-table to main for Task');
    lines.push('then render form-section to modal for Order');
    lines.push('then render null to modal');
    lines.push('');
    lines.push('# Navigation');
    lines.push('then navigate to /tasks');
    lines.push('');
    lines.push('# Database');
    lines.push('then persist create Task');
    lines.push('then persist update Order');
    lines.push('then persist delete Item');
    lines.push('');
    lines.push('# External services');
    lines.push('then call stripe.charge with amount');
    lines.push('');
    lines.push('# Game effects');
    lines.push('then spawn Bullet at Player\'s position');
    lines.push('then despawn');
    lines.push('');
    lines.push('# Notifications');
    lines.push('then show success notification \'Saved!\'');
    lines.push('```');
    lines.push('');

    // Guards
    lines.push('## Guards');
    lines.push('');
    lines.push('Guards are conditions that must be true for a transition to occur.');
    lines.push('');
    lines.push('| Operator | Domain Patterns | Description |');
    lines.push('|----------|-----------------|-------------|');
    for (const [op, mapping] of Object.entries(GUARD_REGISTRY)) {
        const patterns = mapping.domainPatterns.map(p => `\`${p}\``).join(', ');
        lines.push(`| \`${op}\` | ${patterns} | ${mapping.description} |`);
    }
    lines.push('');

    // Guard Examples
    lines.push('### Guard Examples');
    lines.push('');
    lines.push('```');
    lines.push('# Comparison guards');
    lines.push('if status is \'active\'');
    lines.push('if amount > 100');
    lines.push('if health is at least 0');
    lines.push('if priority <= 3');
    lines.push('');
    lines.push('# Compound guards');
    lines.push('if health >= 30 and health < 70');
    lines.push('if status is \'active\' or status is \'pending\'');
    lines.push('if status is not \'deleted\'');
    lines.push('');
    lines.push('# Payload checks');
    lines.push('if incoming amount > 0');
    lines.push('```');
    lines.push('');

    // UI Slots
    lines.push('## UI Slots');
    lines.push('');
    lines.push('UI slots are named regions where patterns can be rendered.');
    lines.push('');
    lines.push('| Slot | Description |');
    lines.push('|------|-------------|');
    const slotDescriptions: Record<string, string> = {
        'main': 'Primary content area',
        'sidebar': 'Side navigation or secondary content',
        'modal': 'Modal dialog overlay',
        'drawer': 'Slide-out panel',
        'overlay': 'Full-screen overlay',
        'center': 'Centered content area',
        'toast': 'Toast notifications',
        'hud-top': 'Top HUD (games)',
        'hud-bottom': 'Bottom HUD (games)',
        'floating': 'Floating elements',
        'system': 'System components (invisible)',
    };
    for (const slot of UI_SLOTS) {
        const desc = slotDescriptions[slot] || '-';
        lines.push(`| \`${slot}\` | ${desc} |`);
    }
    lines.push('');

    // Bindings
    lines.push('## Bindings');
    lines.push('');
    lines.push('Bindings reference data in S-Expression context.');
    lines.push('In Domain Language, these are expressed more naturally.');
    lines.push('');
    lines.push('| S-Expression | Domain Language |');
    lines.push('|--------------|-----------------|');
    lines.push('| `@entity.field` | `field` or `Entity\'s field` |');
    lines.push('| `@payload.field` | `incoming field` |');
    lines.push('| `@state` | `current state` |');
    lines.push('| `@now` | `now` |');
    lines.push('');

    // Statistics
    lines.push('## Statistics');
    lines.push('');
    lines.push('| Category | Count |');
    lines.push('|----------|-------|');
    lines.push(`| Field Types | ${stats.fieldTypes} |`);
    lines.push(`| Effects | ${stats.effects} |`);
    lines.push(`| Guards | ${stats.guards} |`);
    lines.push(`| UI Slots | ${stats.uiSlots} |`);
    lines.push('');

    return lines.join('\n');
}
