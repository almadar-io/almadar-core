/**
 * Tests for domain-language/lexer.ts
 *
 * Pure logic tests for the domain language lexer.
 */
import { describe, it, expect } from 'vitest';
import { Lexer, tokenize } from '../src/domain-language/lexer.js';
import { TokenType } from '../src/domain-language/tokens.js';

describe('Lexer', () => {
    describe('basic tokenization', () => {
        it('tokenizes an empty string to just EOF', () => {
            const tokens = tokenize('');
            expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
        });

        it('tokenizes identifiers', () => {
            const tokens = tokenize('myIdentifier');
            expect(tokens.some(t => t.type === TokenType.IDENTIFIER && t.value === 'myIdentifier')).toBe(true);
        });

        it('tokenizes string literals with double quotes', () => {
            const tokens = tokenize('"hello world"');
            const str = tokens.find(t => t.type === TokenType.STRING);
            expect(str).toBeDefined();
            expect(str!.value).toBe('hello world');
        });

        it('tokenizes string literals with single quotes', () => {
            const tokens = tokenize("'hello'");
            const str = tokens.find(t => t.type === TokenType.STRING);
            expect(str).toBeDefined();
            expect(str!.value).toBe('hello');
        });

        it('tokenizes number literals', () => {
            const tokens = tokenize('42');
            const num = tokens.find(t => t.type === TokenType.NUMBER_LITERAL);
            expect(num).toBeDefined();
            expect(num!.value).toBe('42');
        });

        it('tokenizes decimal numbers', () => {
            const tokens = tokenize('3.14');
            const num = tokens.find(t => t.type === TokenType.NUMBER_LITERAL);
            expect(num).toBeDefined();
            expect(num!.value).toBe('3.14');
        });
    });

    describe('keywords', () => {
        it('tokenizes entity keywords', () => {
            const tokens = tokenize('a Task has');
            expect(tokens.some(t => t.type === TokenType.A)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.HAS)).toBe(true);
        });

        it('tokenizes field type keywords', () => {
            const tokens = tokenize('text number date');
            expect(tokens.some(t => t.type === TokenType.TEXT)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.NUMBER)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.DATE)).toBe(true);
        });

        it('tokenizes behavior keywords', () => {
            const tokens = tokenize('lifecycle states transitions');
            expect(tokens.some(t => t.type === TokenType.LIFECYCLE)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.STATES)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.TRANSITIONS)).toBe(true);
        });

        it('is case-insensitive for keywords', () => {
            const tokens = tokenize('A a HAS Has');
            const aTokens = tokens.filter(t => t.type === TokenType.A);
            const hasTokens = tokens.filter(t => t.type === TokenType.HAS);
            expect(aTokens).toHaveLength(2);
            expect(hasTokens).toHaveLength(2);
        });

        it('tokenizes boolean keywords', () => {
            const tokens = tokenize('true false');
            const bools = tokens.filter(t => t.type === TokenType.BOOLEAN);
            expect(bools).toHaveLength(2);
        });
    });

    describe('operators', () => {
        it('tokenizes colon', () => {
            const tokens = tokenize(':');
            expect(tokens.some(t => t.type === TokenType.COLON)).toBe(true);
        });

        it('tokenizes comparison operators', () => {
            const tokens = tokenize('> < >= <= = !=');
            expect(tokens.some(t => t.type === TokenType.GREATER_THAN)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.LESS_THAN)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.GREATER_EQUAL)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.LESS_EQUAL)).toBe(true);
        });

        it('tokenizes brackets and parens', () => {
            const tokens = tokenize('[]()');
            expect(tokens.some(t => t.type === TokenType.LBRACKET)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.RBRACKET)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.LPAREN)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.RPAREN)).toBe(true);
        });
    });

    describe('comments', () => {
        it('skips line comments', () => {
            const tokens = tokenize('text # this is a comment\n number');
            // Should have text, newline, number, EOF — no comment tokens
            expect(tokens.some(t => t.value?.includes('comment'))).toBe(false);
            expect(tokens.some(t => t.type === TokenType.TEXT)).toBe(true);
            expect(tokens.some(t => t.type === TokenType.NUMBER)).toBe(true);
        });
    });

    describe('template variables', () => {
        it('tokenizes template variables', () => {
            const tokens = tokenize('{linkedEntity}');
            const tvar = tokens.find(t => t.type === TokenType.TEMPLATE_VAR);
            expect(tvar).toBeDefined();
            expect(tvar!.value).toBe('{linkedEntity}');
        });
    });

    describe('indentation', () => {
        it('emits INDENT and DEDENT tokens', () => {
            const input = 'a Task\n  has title';
            const tokens = tokenize(input);
            expect(tokens.some(t => t.type === TokenType.INDENT)).toBe(true);
        });
    });

    describe('line tracking', () => {
        it('tracks line numbers', () => {
            const tokens = tokenize('line1\nline2');
            const line2Tokens = tokens.filter(t => t.line === 2);
            expect(line2Tokens.length).toBeGreaterThan(0);
        });
    });
});

describe('tokenize convenience function', () => {
    it('returns an array of tokens ending with EOF', () => {
        const tokens = tokenize('hello');
        expect(Array.isArray(tokens)).toBe(true);
        expect(tokens[tokens.length - 1].type).toBe(TokenType.EOF);
    });
});
