/**
 * Domain Language Lexer
 *
 * Tokenizes domain language text into tokens for parsing.
 */

import { Token, TokenType, KEYWORDS } from './tokens.js';

export class Lexer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;
  private indentStack: number[] = [0];

  constructor(input: string) {
    this.input = input;
  }

  /**
   * Tokenize the entire input
   */
  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    // Add any remaining DEDENT tokens
    while (this.indentStack.length > 1) {
      this.indentStack.pop();
      tokens.push(this.makeToken(TokenType.DEDENT, ''));
    }

    tokens.push(this.makeToken(TokenType.EOF, ''));
    return tokens;
  }

  private nextToken(): Token | null {
    // Handle start of line (indentation)
    if (this.column === 1) {
      const indentToken = this.handleIndentation();
      if (indentToken) {
        return indentToken;
      }
    }

    this.skipWhitespace();

    if (this.isAtEnd()) {
      return null;
    }

    const char = this.peek();

    // Newline
    if (char === '\n') {
      return this.consumeNewline();
    }

    // Skip comments
    if (char === '#') {
      this.skipToEndOfLine();
      return this.nextToken();
    }

    // String literal
    if (char === '"' || char === "'") {
      return this.consumeString(char);
    }

    // Number
    if (this.isDigit(char)) {
      return this.consumeNumber();
    }

    // Operators and punctuation
    switch (char) {
      case ':':
        return this.consumeChar(TokenType.COLON);
      case ',':
        return this.consumeChar(TokenType.COMMA);
      case '|':
        return this.consumeChar(TokenType.PIPE);
      case '.':
        return this.consumeChar(TokenType.DOT);
      case '-':
        return this.consumeChar(TokenType.DASH);
      case '[':
        return this.consumeChar(TokenType.LBRACKET);
      case ']':
        return this.consumeChar(TokenType.RBRACKET);
      case '(':
        return this.consumeChar(TokenType.LPAREN);
      case ')':
        return this.consumeChar(TokenType.RPAREN);
      case '>':
        if (this.peekNext() === '=') {
          return this.consumeChars(2, TokenType.GREATER_EQUAL);
        }
        return this.consumeChar(TokenType.GREATER_THAN);
      case '<':
        if (this.peekNext() === '=') {
          return this.consumeChars(2, TokenType.LESS_EQUAL);
        }
        return this.consumeChar(TokenType.LESS_THAN);
      case '=':
        if (this.peekNext() === '=') {
          return this.consumeChars(2, TokenType.EQUALS);
        }
        break;
      case '!':
        if (this.peekNext() === '=') {
          return this.consumeChars(2, TokenType.NOT_EQUALS);
        }
        break;
    }

    // Template variable: {varName}
    if (char === '{') {
      return this.consumeTemplateVar();
    }

    // Identifier or keyword
    if (this.isAlpha(char)) {
      return this.consumeIdentifier();
    }

    // Unknown character - skip it
    this.advance();
    return this.nextToken();
  }

  private consumeTemplateVar(): Token {
    const start = this.pos;
    this.advance(); // consume '{'

    // Track nested braces to handle JSON objects with nested objects/arrays
    let braceDepth = 1;

    // Collect characters until matching closing '}'
    while (!this.isAtEnd() && braceDepth > 0 && this.peek() !== '\n') {
      const ch = this.peek();
      if (ch === '{') {
        braceDepth++;
      } else if (ch === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          this.advance(); // consume final '}'
          break;
        }
      }
      this.advance();
    }

    const value = this.input.substring(start, this.pos);
    return this.makeToken(TokenType.TEMPLATE_VAR, value);
  }

  private handleIndentation(): Token | null {
    if (this.isAtEnd() || this.peek() === '\n') {
      return null;
    }

    let indent = 0;
    while (this.peek() === ' ' || this.peek() === '\t') {
      indent += this.peek() === '\t' ? 4 : 1;
      this.advance();
    }

    // Skip blank lines
    if (this.peek() === '\n' || this.peek() === '#') {
      return null;
    }

    const currentIndent = this.indentStack[this.indentStack.length - 1];

    if (indent > currentIndent) {
      this.indentStack.push(indent);
      return this.makeToken(TokenType.INDENT, '');
    } else if (indent < currentIndent) {
      // Pop indent levels until we match
      while (this.indentStack.length > 1 &&
             this.indentStack[this.indentStack.length - 1] > indent) {
        this.indentStack.pop();
      }
      return this.makeToken(TokenType.DEDENT, '');
    }

    return null;
  }

  private consumeNewline(): Token {
    const token = this.makeToken(TokenType.NEWLINE, '\n');
    this.advance();
    this.line++;
    this.column = 1;
    return token;
  }

  private consumeString(quote: string): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.pos;

    this.advance(); // Opening quote

    let value = '';
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === '\\' && this.peekNext() === quote) {
        this.advance();
        value += quote;
      } else if (this.peek() === '\n') {
        // Multi-line strings not supported
        break;
      } else {
        value += this.peek();
      }
      this.advance();
    }

    if (this.peek() === quote) {
      this.advance(); // Closing quote
    }

    return {
      type: TokenType.STRING,
      value,
      line: startLine,
      column: startColumn,
      offset: startOffset,
    };
  }

  private consumeNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.pos;

    let value = '';
    while (this.isDigit(this.peek())) {
      value += this.advance();
    }

    // Decimal part
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      value += this.advance(); // .
      while (this.isDigit(this.peek())) {
        value += this.advance();
      }
    }

    return {
      type: TokenType.NUMBER_LITERAL,
      value,
      line: startLine,
      column: startColumn,
      offset: startOffset,
    };
  }

  private consumeIdentifier(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    const startOffset = this.pos;

    let value = '';
    while (this.isAlphaNumeric(this.peek()) || this.peek() === '_' || this.peek() === '/') {
      value += this.advance();
    }

    // Check for keywords
    const lowerValue = value.toLowerCase();
    const keywordType = KEYWORDS[lowerValue];

    return {
      type: keywordType || TokenType.IDENTIFIER,
      value,
      line: startLine,
      column: startColumn,
      offset: startOffset,
    };
  }

  private consumeChar(type: TokenType): Token {
    const token = this.makeToken(type, this.peek());
    this.advance();
    return token;
  }

  private consumeChars(count: number, type: TokenType): Token {
    let value = '';
    for (let i = 0; i < count; i++) {
      value += this.advance();
    }
    return {
      type,
      value,
      line: this.line,
      column: this.column - count,
      offset: this.pos - count,
    };
  }

  private skipWhitespace(): void {
    while (!this.isAtEnd() && (this.peek() === ' ' || this.peek() === '\t')) {
      this.advance();
    }
  }

  private skipToEndOfLine(): void {
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private makeToken(type: TokenType, value: string): Token {
    return {
      type,
      value,
      line: this.line,
      column: this.column,
      offset: this.pos,
    };
  }

  private peek(): string {
    return this.input[this.pos] || '\0';
  }

  private peekNext(): string {
    return this.input[this.pos + 1] || '\0';
  }

  private advance(): string {
    const char = this.peek();
    this.pos++;
    this.column++;
    return char;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') ||
           (char >= 'A' && char <= 'Z') ||
           char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}

/**
 * Convenience function to tokenize a string
 */
export function tokenize(input: string): Token[] {
  const lexer = new Lexer(input);
  return lexer.tokenize();
}
