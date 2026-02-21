/**
 * Domain Language Documentation Generator — CLI script
 *
 * Generates reference documentation from the type registry.
 * Output is written to docs/DOMAIN_LANGUAGE_REFERENCE.md
 *
 * Usage:
 *   npx tsx src/domain-language/generate-docs.ts
 *
 * @packageDocumentation
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { generateDomainLanguageReference } from './domain-language-reference.js';

// Re-export for backward compatibility
export { generateDomainLanguageReference } from './domain-language-reference.js';

/**
 * Write documentation to file
 */
export function writeDomainLanguageReference(outputPath?: string): void {
    const content = generateDomainLanguageReference();
    const defaultPath = path.join(__dirname, '../../../../docs/DOMAIN_LANGUAGE_REFERENCE.md');
    const targetPath = outputPath || defaultPath;

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(targetPath, content, 'utf-8');
    console.log(`Documentation written to: ${targetPath}`);
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Run generator when executed directly
 */
async function main() {
    console.log('Generating Domain Language reference documentation...');
    writeDomainLanguageReference();
    console.log('Done!');
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main().catch(console.error);
}
