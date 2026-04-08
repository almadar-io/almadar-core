/**
 * lolo-type-metadata.ts
 *
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 *
 * Regenerate with:
 *   cd packages/almadar-core && npx tsx scripts/build-lolo-type-metadata.ts
 *
 * This module ships @almadar/core's type metadata as a runtime constant
 * so consumers like @almadar-tools/lolo-types-sync can import it via the
 * package's public API instead of walking workspace source files.
 */

export const LOLO_TYPE_METADATA = {
  "generatedAt": "2026-04-08T05:13:35.374Z",
  "enums": [
    {
      "name": "EntityPersistence",
      "values": [
        "persistent",
        "runtime",
        "singleton",
        "instance",
        "local"
      ],
      "source": "src/types/entity.ts:25"
    },
    {
      "name": "EventScope",
      "values": [
        "internal",
        "external"
      ],
      "source": "src/types/trait.ts:176"
    },
    {
      "name": "FieldFormat",
      "values": [
        "email",
        "url",
        "phone",
        "date",
        "datetime",
        "uuid"
      ],
      "source": "src/types/field.ts:133"
    },
    {
      "name": "FieldType",
      "values": [
        "string",
        "number",
        "boolean",
        "date",
        "timestamp",
        "datetime",
        "array",
        "object",
        "enum",
        "relation"
      ],
      "source": "src/types/field.ts:23"
    },
    {
      "name": "RelationCardinality",
      "values": [
        "one",
        "many",
        "one-to-many",
        "many-to-one",
        "many-to-many"
      ],
      "source": "src/types/field.ts:56"
    },
    {
      "name": "TraitCategory",
      "values": [
        "lifecycle",
        "temporal",
        "validation",
        "notification",
        "integration",
        "interaction",
        "agent",
        "game-core",
        "game-character",
        "game-ai",
        "game-combat",
        "game-items",
        "game-cards",
        "game-board",
        "game-puzzle"
      ],
      "source": "src/types/trait.ts:25"
    },
    {
      "name": "UISlot",
      "values": [
        "main",
        "sidebar",
        "modal",
        "drawer",
        "overlay",
        "center",
        "toast",
        "floating",
        "system",
        "content",
        "screen",
        "hud",
        "hud-top",
        "hud-bottom",
        "hud.health",
        "hud.score",
        "hud.inventory",
        "hud.stamina",
        "overlay.inventory",
        "overlay.dialogue",
        "overlay.menu",
        "overlay.pause"
      ],
      "source": "src/types/effect.ts:20"
    }
  ],
  "structs": [
    {
      "name": "EntityField",
      "fields": [
        {
          "name": "name",
          "type": "string",
          "optional": false
        },
        {
          "name": "type",
          "type": "FieldType",
          "optional": false
        },
        {
          "name": "required",
          "type": "boolean",
          "optional": true
        },
        {
          "name": "default",
          "type": "any",
          "optional": true
        },
        {
          "name": "values",
          "type": "[string]",
          "optional": true
        },
        {
          "name": "enum",
          "type": "[string]",
          "optional": true
        },
        {
          "name": "format",
          "type": "FieldFormat",
          "optional": true
        },
        {
          "name": "min",
          "type": "number",
          "optional": true
        },
        {
          "name": "max",
          "type": "number",
          "optional": true
        },
        {
          "name": "items",
          "type": "EntityField",
          "optional": true
        },
        {
          "name": "relation",
          "type": "RelationConfig",
          "optional": true
        }
      ],
      "source": "src/types/field.ts:151"
    }
  ],
  "bindingRules": {
    "guard": [
      "entity",
      "payload",
      "state",
      "now"
    ],
    "effect": [
      "entity",
      "payload",
      "state",
      "now"
    ],
    "tick": [
      "entity",
      "state",
      "now"
    ],
    "source": "src/types/bindings.ts:101"
  },
  "effectOperators": [
    {
      "name": "async/all",
      "minArity": 1,
      "maxArity": null,
      "params": [
        {
          "name": "args1",
          "type": "Effect",
          "optional": false
        }
      ],
      "description": "Effect tuple from AsyncAllEffect",
      "source": "src/types/effect.ts:405 AsyncAllEffect"
    },
    {
      "name": "async/debounce",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "number | string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "SExpr",
          "optional": false
        }
      ],
      "description": "Effect tuple from AsyncDebounceEffect",
      "source": "src/types/effect.ts:379 AsyncDebounceEffect"
    },
    {
      "name": "async/delay",
      "minArity": 2,
      "maxArity": null,
      "params": [
        {
          "name": "arg1",
          "type": "number | string",
          "optional": false
        },
        {
          "name": "args2",
          "type": "Effect",
          "optional": false
        }
      ],
      "description": "Effect tuple from AsyncDelayEffect",
      "source": "src/types/effect.ts:372 AsyncDelayEffect"
    },
    {
      "name": "async/interval",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "number | string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "SExpr",
          "optional": false
        }
      ],
      "description": "Effect tuple from AsyncIntervalEffect",
      "source": "src/types/effect.ts:393 AsyncIntervalEffect"
    },
    {
      "name": "async/race",
      "minArity": 1,
      "maxArity": null,
      "params": [
        {
          "name": "args1",
          "type": "Effect",
          "optional": false
        }
      ],
      "description": "Effect tuple from AsyncRaceEffect",
      "source": "src/types/effect.ts:399 AsyncRaceEffect"
    },
    {
      "name": "async/sequence",
      "minArity": 1,
      "maxArity": null,
      "params": [
        {
          "name": "args1",
          "type": "Effect",
          "optional": false
        }
      ],
      "description": "Effect tuple from AsyncSequenceEffect",
      "source": "src/types/effect.ts:411 AsyncSequenceEffect"
    },
    {
      "name": "async/throttle",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "number | string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "SExpr",
          "optional": false
        }
      ],
      "description": "Effect tuple from AsyncThrottleEffect",
      "source": "src/types/effect.ts:386 AsyncThrottleEffect"
    },
    {
      "name": "atomic",
      "minArity": 1,
      "maxArity": null,
      "params": [
        {
          "name": "args1",
          "type": "SExpr",
          "optional": false
        }
      ],
      "description": "Effect tuple from AtomicEffect",
      "source": "src/types/effect.ts:312 AtomicEffect"
    },
    {
      "name": "call-service",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "CallServiceConfig",
          "optional": false
        }
      ],
      "description": "Effect tuple from CallServiceEffect",
      "source": "src/types/effect.ts:190 CallServiceEffect"
    },
    {
      "name": "checkpoint/load",
      "minArity": 1,
      "maxArity": 1,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        }
      ],
      "description": "Effect tuple from CheckpointLoadEffect",
      "source": "src/types/effect.ts:349 CheckpointLoadEffect"
    },
    {
      "name": "checkpoint/save",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "any",
          "optional": false
        }
      ],
      "description": "Effect tuple from CheckpointSaveEffect",
      "source": "src/types/effect.ts:343 CheckpointSaveEffect"
    },
    {
      "name": "deref",
      "minArity": 1,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "Record",
          "optional": true
        }
      ],
      "description": "Effect tuple from DerefEffect",
      "source": "src/types/effect.ts:282 DerefEffect"
    },
    {
      "name": "despawn",
      "minArity": 1,
      "maxArity": 1,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        }
      ],
      "description": "Effect tuple from DespawnEffect",
      "source": "src/types/effect.ts:203 DespawnEffect"
    },
    {
      "name": "do",
      "minArity": 1,
      "maxArity": null,
      "params": [
        {
          "name": "args1",
          "type": "SExpr",
          "optional": false
        }
      ],
      "description": "Effect tuple from DoEffect",
      "source": "src/types/effect.ts:210 DoEffect"
    },
    {
      "name": "emit",
      "minArity": 1,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "Record | string",
          "optional": true
        }
      ],
      "description": "Effect tuple from EmitEffect",
      "source": "src/types/effect.ts:163 EmitEffect"
    },
    {
      "name": "evaluate",
      "minArity": 1,
      "maxArity": 1,
      "params": [
        {
          "name": "arg1",
          "type": "Record",
          "optional": false
        }
      ],
      "description": "Effect tuple from EvaluateEffect",
      "source": "src/types/effect.ts:337 EvaluateEffect"
    },
    {
      "name": "fetch",
      "minArity": 1,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "Record",
          "optional": true
        }
      ],
      "description": "Effect tuple from FetchEffect",
      "source": "src/types/effect.ts:226 FetchEffect"
    },
    {
      "name": "forward",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "Record",
          "optional": false
        }
      ],
      "description": "Effect tuple from ForwardEffect",
      "source": "src/types/effect.ts:323 ForwardEffect"
    },
    {
      "name": "if",
      "minArity": 2,
      "maxArity": 3,
      "params": [
        {
          "name": "arg1",
          "type": "Expression",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "SExpr",
          "optional": false
        },
        {
          "name": "arg3",
          "type": "SExpr",
          "optional": true
        }
      ],
      "description": "Effect tuple from IfEffect",
      "source": "src/types/effect.ts:233 IfEffect"
    },
    {
      "name": "let",
      "minArity": 2,
      "maxArity": null,
      "params": [
        {
          "name": "arg1",
          "type": "[[string, any]]",
          "optional": false
        },
        {
          "name": "args2",
          "type": "SExpr",
          "optional": false
        }
      ],
      "description": "Effect tuple from LetEffect",
      "source": "src/types/effect.ts:247 LetEffect"
    },
    {
      "name": "log",
      "minArity": 1,
      "maxArity": null,
      "params": [
        {
          "name": "args1",
          "type": "any",
          "optional": false
        }
      ],
      "description": "Effect tuple from LogEffect",
      "source": "src/types/effect.ts:253 LogEffect"
    },
    {
      "name": "navigate",
      "minArity": 1,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "Record",
          "optional": true
        }
      ],
      "description": "Effect tuple from NavigateEffect",
      "source": "src/types/effect.ts:155 NavigateEffect"
    },
    {
      "name": "notify",
      "minArity": 2,
      "maxArity": 3,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "string | SExpr",
          "optional": false
        },
        {
          "name": "arg3",
          "type": "string",
          "optional": true
        }
      ],
      "description": "Effect tuple from NotifyEffect",
      "source": "src/types/effect.ts:217 NotifyEffect"
    },
    {
      "name": "persist",
      "minArity": 2,
      "maxArity": 3,
      "params": [
        {
          "name": "arg1",
          "type": "\"create\"",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg3",
          "type": "Record | string",
          "optional": true
        }
      ],
      "description": "Effect tuple from PersistEffect",
      "source": "src/types/effect.ts:177 PersistEffect"
    },
    {
      "name": "ref",
      "minArity": 1,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "Record",
          "optional": true
        }
      ],
      "description": "Effect tuple from RefEffect",
      "source": "src/types/effect.ts:271 RefEffect"
    },
    {
      "name": "render-ui",
      "minArity": 2,
      "maxArity": 3,
      "params": [
        {
          "name": "arg1",
          "type": "UISlot",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "AnyPatternConfig",
          "optional": false
        },
        {
          "name": "arg3",
          "type": "Record",
          "optional": true
        }
      ],
      "description": "Effect tuple from RenderUIEffect",
      "source": "src/types/effect.ts:136 RenderUIEffect"
    },
    {
      "name": "set",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "any",
          "optional": false
        }
      ],
      "description": "Effect tuple from SetEffect",
      "source": "src/types/effect.ts:169 SetEffect"
    },
    {
      "name": "spawn",
      "minArity": 1,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "Record",
          "optional": true
        }
      ],
      "description": "Effect tuple from SpawnEffect",
      "source": "src/types/effect.ts:197 SpawnEffect"
    },
    {
      "name": "swap!",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "SExpr",
          "optional": false
        }
      ],
      "description": "Effect tuple from SwapEffect",
      "source": "src/types/effect.ts:293 SwapEffect"
    },
    {
      "name": "train",
      "minArity": 1,
      "maxArity": 1,
      "params": [
        {
          "name": "arg1",
          "type": "Record",
          "optional": false
        }
      ],
      "description": "Effect tuple from TrainEffect",
      "source": "src/types/effect.ts:330 TrainEffect"
    },
    {
      "name": "wait",
      "minArity": 1,
      "maxArity": 1,
      "params": [
        {
          "name": "arg1",
          "type": "number",
          "optional": false
        }
      ],
      "description": "Effect tuple from WaitEffect",
      "source": "src/types/effect.ts:259 WaitEffect"
    },
    {
      "name": "watch",
      "minArity": 2,
      "maxArity": 3,
      "params": [
        {
          "name": "arg1",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "string",
          "optional": false
        },
        {
          "name": "arg3",
          "type": "Record",
          "optional": true
        }
      ],
      "description": "Effect tuple from WatchEffect",
      "source": "src/types/effect.ts:301 WatchEffect"
    },
    {
      "name": "when",
      "minArity": 2,
      "maxArity": 2,
      "params": [
        {
          "name": "arg1",
          "type": "Expression",
          "optional": false
        },
        {
          "name": "arg2",
          "type": "SExpr",
          "optional": false
        }
      ],
      "description": "Effect tuple from WhenEffect",
      "source": "src/types/effect.ts:240 WhenEffect"
    }
  ]
} as const;

export type LoloTypeMetadata = typeof LOLO_TYPE_METADATA;
