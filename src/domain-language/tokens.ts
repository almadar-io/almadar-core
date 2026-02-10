/**
 * Domain Language Tokens
 *
 * Token definitions for the domain language lexer.
 */

export enum TokenType {
  // Whitespace & Structure
  NEWLINE = 'NEWLINE',
  INDENT = 'INDENT',
  DEDENT = 'DEDENT',

  // Template Variables (e.g., {linkedEntity})
  TEMPLATE_VAR = 'TEMPLATE_VAR',

  // Keywords - Entity
  A = 'A',
  AN = 'AN',
  IS = 'IS',
  IT = 'IT',
  HAS = 'HAS',
  BELONGS = 'BELONGS',
  TO = 'TO',
  MANY = 'MANY',
  ONE = 'ONE',
  AS = 'AS',
  CAN = 'CAN',
  BE = 'BE',
  STARTS = 'STARTS',

  // Keywords - Page
  THE = 'THE',
  SHOWS = 'SHOWS',
  ENTITY = 'ENTITY',   // Explicit entity reference for pages
  PURPOSE = 'PURPOSE',
  URL = 'URL',
  DISPLAYS = 'DISPLAYS',
  USERS = 'USERS',
  WHEN = 'WHEN',
  ACCESSED = 'ACCESSED',

  // Keywords - Behavior
  LIFECYCLE = 'LIFECYCLE',
  BEHAVIOR = 'BEHAVIOR',
  STATES = 'STATES',
  INITIAL = 'INITIAL',
  TRANSITIONS = 'TRANSITIONS',
  FROM = 'FROM',
  IF = 'IF',
  THEN = 'THEN',
  RULES = 'RULES',
  EVERY = 'EVERY',
  CHECK = 'CHECK',

  // Keywords - Guard
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  PROVIDED = 'PROVIDED',
  EMPTY = 'EMPTY',
  USER = 'USER',
  OWNS = 'OWNS',
  THIS = 'THIS',

  // Field Types
  TEXT = 'TEXT',
  LONG_TEXT = 'LONG_TEXT',
  NUMBER = 'NUMBER',
  CURRENCY = 'CURRENCY',
  DATE = 'DATE',
  TIMESTAMP = 'TIMESTAMP',
  YES_NO = 'YES_NO',
  ENUM = 'ENUM',
  LIST = 'LIST',

  // Constraints
  REQUIRED = 'REQUIRED',
  UNIQUE = 'UNIQUE',
  AUTO = 'AUTO',
  DEFAULT = 'DEFAULT',

  // Operators
  COLON = 'COLON',
  COMMA = 'COMMA',
  PIPE = 'PIPE',
  DOT = 'DOT',
  DASH = 'DASH',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  GREATER_EQUAL = 'GREATER_EQUAL',
  LESS_EQUAL = 'LESS_EQUAL',
  EQUALS = 'EQUALS',
  NOT_EQUALS = 'NOT_EQUALS',

  // Literals
  IDENTIFIER = 'IDENTIFIER',
  STRING = 'STRING',
  NUMBER_LITERAL = 'NUMBER_LITERAL',
  BOOLEAN = 'BOOLEAN',

  // Special
  EOF = 'EOF',
  ERROR = 'ERROR',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  offset: number;
}

// Keyword mappings (case-insensitive)
export const KEYWORDS: Record<string, TokenType> = {
  'a': TokenType.A,
  'an': TokenType.AN,
  'is': TokenType.IS,
  'it': TokenType.IT,
  'has': TokenType.HAS,
  'belongs': TokenType.BELONGS,
  'to': TokenType.TO,
  'many': TokenType.MANY,
  'one': TokenType.ONE,
  'as': TokenType.AS,
  'can': TokenType.CAN,
  'be': TokenType.BE,
  'starts': TokenType.STARTS,
  'the': TokenType.THE,
  'shows': TokenType.SHOWS,
  'entity': TokenType.ENTITY,
  'purpose': TokenType.PURPOSE,
  'url': TokenType.URL,
  'displays': TokenType.DISPLAYS,
  'users': TokenType.USERS,
  'when': TokenType.WHEN,
  'on': TokenType.WHEN,  // "on EVENT" is equivalent to "when EVENT"
  'accessed': TokenType.ACCESSED,
  'lifecycle': TokenType.LIFECYCLE,
  'behavior': TokenType.BEHAVIOR,
  'states': TokenType.STATES,
  'initial': TokenType.INITIAL,
  'transitions': TokenType.TRANSITIONS,
  'from': TokenType.FROM,
  'if': TokenType.IF,
  'then': TokenType.THEN,
  'rules': TokenType.RULES,
  'every': TokenType.EVERY,
  'check': TokenType.CHECK,
  'and': TokenType.AND,
  'or': TokenType.OR,
  'not': TokenType.NOT,
  'provided': TokenType.PROVIDED,
  'empty': TokenType.EMPTY,
  'user': TokenType.USER,
  'owns': TokenType.OWNS,
  'this': TokenType.THIS,
  'text': TokenType.TEXT,
  'number': TokenType.NUMBER,
  'currency': TokenType.CURRENCY,
  'date': TokenType.DATE,
  'timestamp': TokenType.TIMESTAMP,
  'required': TokenType.REQUIRED,
  'unique': TokenType.UNIQUE,
  'auto': TokenType.AUTO,
  'default': TokenType.DEFAULT,
  'true': TokenType.BOOLEAN,
  'false': TokenType.BOOLEAN,
};

// Multi-word keywords
export const MULTI_WORD_KEYWORDS: Record<string, TokenType> = {
  'long text': TokenType.LONG_TEXT,
  'yes/no': TokenType.YES_NO,
  'belongs to': TokenType.BELONGS,
  'has many': TokenType.HAS,
  'has one': TokenType.HAS,
  'starts as': TokenType.STARTS,
  'can be': TokenType.CAN,
  'it has': TokenType.IT,
};
