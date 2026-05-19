import type { EntityField } from '../types/field.js';
import type { EntityPersistence } from '../types/entity.js';
import type { TraitReference } from '../types/trait.js';
import type {
  FactoryCallSite,
  FactoryCallSiteParams,
  FactoryParamValue,
  FactorySignature,
  FactoryTraitSignature,
} from './types.js';
import type {
  OwnershipOverlayEntry,
  PresentationNavItem,
  PresentationOverlay,
  RuleOverlay,
  RuleOverlayEntry,
  TraitOverlay,
  TraitOverlayEntry,
} from './overlays.js';

/**
 * The per-orbital binding the agent assembles when it picks a
 * signature. Carries the user-authored overrides directly; no shared
 * domain ontology, no DomainDocument.
 */
export interface TranslationBinding {
  /** Entity name override. When equal to `signature.entities[0].name`,
   *  no rename is emitted. */
  entityName: string;
  /** Extra fields beyond the signature's canonical entity surface. */
  entityFields?: ReadonlyArray<EntityField>;
  /** Persistence override. */
  persistence?: EntityPersistence;
  /** Collection name override. */
  collection?: string;
  /** Per-page path overrides keyed by `signature.pages[i].name`. */
  pagePaths?: Readonly<Record<string, string>>;
}

export interface TranslationWarning {
  /** Dotted path of the binding field that couldn't be lowered. */
  field: string;
  /** Human-readable reason. */
  reason: string;
}

export interface TranslationResult {
  callSite: FactoryCallSite;
  warnings: ReadonlyArray<TranslationWarning>;
}

export function translateOverlaysToParams(
  binding: TranslationBinding,
  signature: FactorySignature,
  presentation?: PresentationOverlay,
  ruleOverlay?: RuleOverlay,
  traitOverlay?: TraitOverlay,
  catalog?: ReadonlyArray<FactorySignature>,
): TranslationResult {
  const warnings: TranslationWarning[] = [];
  const params: FactoryCallSiteParams = {};

  applyEntityName(binding, signature, params);
  applyEntityFields(binding, signature, params);
  applyPersistence(binding, signature, params, warnings);
  applyCollection(binding, params);
  applyPagePaths(binding, signature, params, warnings);
  applyPresentation(presentation, signature, params, warnings);
  applyTraitOverlay(traitOverlay, signature, params, warnings);
  applyRuleOverlay(ruleOverlay, signature, binding, catalog, params, warnings);

  return {
    callSite: {
      organism: signature.organism,
      orbital: signature.orbital,
      factoryPath: signature.factoryPath,
      params,
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Per-field lowering
// ---------------------------------------------------------------------------

function applyEntityName(
  binding: TranslationBinding,
  signature: FactorySignature,
  params: FactoryCallSiteParams,
): void {
  if (signature.entities.length === 0) return;
  if (binding.entityName === signature.entities[0].name) return;
  params.entityName = binding.entityName;
}

function applyEntityFields(
  binding: TranslationBinding,
  signature: FactorySignature,
  params: FactoryCallSiteParams,
): void {
  if (!binding.entityFields || binding.entityFields.length === 0) return;
  if (signature.entities.length === 0) {
    params.entityFields = [...binding.entityFields];
    return;
  }
  const canonical = new Set(signature.entities[0].fields.map((f) => f.name));
  const extras: EntityField[] = [];
  for (const f of binding.entityFields) {
    if (f.name && canonical.has(f.name)) continue;
    extras.push(f);
  }
  if (extras.length > 0) params.entityFields = extras;
}

function applyPersistence(
  binding: TranslationBinding,
  signature: FactorySignature,
  params: FactoryCallSiteParams,
  warnings: TranslationWarning[],
): void {
  if (!binding.persistence) return;
  if (signature.entities.length === 0) {
    warnings.push({
      field: `entity.${binding.entityName}.persistence`,
      reason: 'factory signature has no entity to apply persistence to',
    });
    return;
  }
  if (binding.persistence === signature.entities[0].persistence) return;
  params.persistence = binding.persistence;
}

function applyCollection(
  binding: TranslationBinding,
  params: FactoryCallSiteParams,
): void {
  if (!binding.collection) return;
  params.collection = binding.collection;
}

function applyPagePaths(
  binding: TranslationBinding,
  signature: FactorySignature,
  params: FactoryCallSiteParams,
  warnings: TranslationWarning[],
): void {
  if (!binding.pagePaths) return;
  const sigPages = new Map(signature.pages.map((p) => [p.name, p]));
  const overrides: Record<string, string> = {};
  for (const [pageName, url] of Object.entries(binding.pagePaths)) {
    const sig = sigPages.get(pageName);
    if (!sig) {
      warnings.push({
        field: `page.${pageName}.url`,
        reason: `factory signature has no page named "${pageName}"`,
      });
      continue;
    }
    if (sig.defaultPath !== url) overrides[pageName] = url;
  }
  if (Object.keys(overrides).length > 0) params.pagePaths = overrides;
}

function applyPresentation(
  overlay: PresentationOverlay | undefined,
  signature: FactorySignature,
  params: FactoryCallSiteParams,
  warnings: TranslationWarning[],
): void {
  if (!overlay?.navAdditions || overlay.navAdditions.length === 0) return;
  const target = signature.traits.find((t) =>
    t.overridableConfigKeys.some((p) => p.key === 'navItems'),
  );
  if (!target) {
    warnings.push({
      field: 'presentation.navAdditions',
      reason:
        'factory signature has no trait advertising a `navItems` config key',
    });
    return;
  }
  const existing = params.traitOverrides?.[target.name] ?? {};
  const existingConfig = existing.config ?? {};
  const items: ReadonlyArray<FactoryParamValue> = overlay.navAdditions.map(
    navItemToParamValue,
  );
  params.traitOverrides = {
    ...params.traitOverrides,
    [target.name]: {
      ...existing,
      config: { ...existingConfig, navItems: items },
    },
  };
}

function applyTraitOverlay(
  overlay: TraitOverlay | undefined,
  signature: FactorySignature,
  params: FactoryCallSiteParams,
  warnings: TranslationWarning[],
): void {
  if (!overlay) return;
  const traitsByName = new Map(signature.traits.map((t) => [t.name, t]));
  for (const [traitName, entry] of Object.entries(overlay)) {
    const trait = traitsByName.get(traitName);
    if (!trait) {
      warnings.push({
        field: `traitOverlay.${traitName}`,
        reason: `factory signature has no trait named "${traitName}"`,
      });
      continue;
    }
    mergeTraitOverride(traitName, entry, trait, params, warnings);
  }
}

function mergeTraitOverride(
  traitName: string,
  entry: TraitOverlayEntry,
  trait: FactoryTraitSignature,
  params: FactoryCallSiteParams,
  warnings: TranslationWarning[],
): void {
  const advertised = new Set(trait.overridableConfigKeys.map((p) => p.key));
  const existing = params.traitOverrides?.[traitName] ?? {};
  const existingConfig = existing.config ?? {};
  const mergedConfig: Record<string, FactoryParamValue> = { ...existingConfig };

  if (entry.config) {
    for (const [k, v] of Object.entries(entry.config)) {
      if (!advertised.has(k)) {
        const advertisedKeys = trait.overridableConfigKeys.map((p) => p.key).join(', ');
        warnings.push({
          field: `traitOverlay.${traitName}.config.${k}`,
          reason: `trait does not advertise config key "${k}" (overridableConfigKeys: [${advertisedKeys}])`,
        });
        continue;
      }
      mergedConfig[k] = v;
    }
  }

  params.traitOverrides = {
    ...params.traitOverrides,
    [traitName]: {
      ...existing,
      ...(Object.keys(mergedConfig).length > 0 ? { config: mergedConfig } : {}),
    },
  };
}

function applyRuleOverlay(
  overlay: RuleOverlay | undefined,
  signature: FactorySignature,
  binding: TranslationBinding,
  catalog: ReadonlyArray<FactorySignature> | undefined,
  params: FactoryCallSiteParams,
  warnings: TranslationWarning[],
): void {
  if (!overlay) return;

  for (const rule of overlay.rules) {
    if (!ruleAppliesToBinding(rule, binding)) continue;
    if (!catalog) {
      warnings.push({
        field: `ruleOverlay.rules.${rule.id}`,
        reason: 'rule overlay supplied without a catalog — capability lookup requires one',
      });
      continue;
    }
    const match = findTraitByCapability(catalog, rule.capability);
    if (!match) {
      warnings.push({
        field: `ruleOverlay.rules.${rule.id}`,
        reason: `no trait in the catalog advertises capability "${rule.capability}"`,
      });
      continue;
    }
    appendRuleExtraTrait(rule, match, binding, params);
    if (rule.config) {
      threadRuleConfig(rule, match.trait, params, warnings);
    }
  }

  if (overlay.ownership) {
    for (const entry of overlay.ownership) {
      if (entry.entity !== binding.entityName) continue;
      applyOwnership(entry, params, signature, catalog, warnings);
    }
  }
}

function ruleAppliesToBinding(
  rule: RuleOverlayEntry,
  binding: TranslationBinding,
): boolean {
  if (rule.appliesTo.length === 0) return true;
  return rule.appliesTo.includes(binding.entityName);
}

interface CapabilityMatch {
  signature: FactorySignature;
  trait: FactoryTraitSignature;
}

function findTraitByCapability(
  catalog: ReadonlyArray<FactorySignature>,
  capability: string,
): CapabilityMatch | undefined {
  for (const sig of catalog) {
    for (const trait of sig.traits) {
      if (trait.capabilities.includes(capability)) {
        return { signature: sig, trait };
      }
    }
  }
  return undefined;
}

function appendRuleExtraTrait(
  _rule: RuleOverlayEntry,
  match: CapabilityMatch,
  binding: TranslationBinding,
  params: FactoryCallSiteParams,
): void {
  const fromPath = `std/behaviors/${match.signature.organism}`;
  const alias = organismToAlias(match.signature.organism);
  const ref: TraitReference = {
    from: fromPath,
    ref: `${alias}.traits.${match.trait.name}`,
    linkedEntity: binding.entityName,
  };
  const existing = params.extraTraits ?? [];
  params.extraTraits = [...existing, ref];
}

function organismToAlias(organism: string): string {
  const trimmed = organism.startsWith('std-') ? organism.slice(4) : organism;
  return trimmed
    .split('-')
    .filter((s) => s.length > 0)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function threadRuleConfig(
  rule: RuleOverlayEntry,
  trait: FactoryTraitSignature,
  params: FactoryCallSiteParams,
  warnings: TranslationWarning[],
): void {
  if (!rule.config) return;
  const advertised = new Set(trait.overridableConfigKeys.map((p) => p.key));
  const existing = params.traitOverrides?.[trait.name] ?? {};
  const existingConfig = existing.config ?? {};
  const merged: Record<string, FactoryParamValue> = { ...existingConfig };
  for (const [k, v] of Object.entries(rule.config)) {
    if (!advertised.has(k)) {
      warnings.push({
        field: `ruleOverlay.rules.${rule.id}.config.${k}`,
        reason: `trait "${trait.name}" does not advertise config key "${k}"`,
      });
      continue;
    }
    merged[k] = v;
  }
  if (Object.keys(merged).length > 0) {
    params.traitOverrides = {
      ...params.traitOverrides,
      [trait.name]: { ...existing, config: merged },
    };
  }
}

function applyOwnership(
  entry: OwnershipOverlayEntry,
  params: FactoryCallSiteParams,
  signature: FactorySignature,
  catalog: ReadonlyArray<FactorySignature> | undefined,
  warnings: TranslationWarning[],
): void {
  const local = signature.traits.find((t) =>
    t.overridableConfigKeys.some((p) => p.key === 'ownerField'),
  );
  if (local) {
    writeOwnerField(local.name, entry.ownerField, params);
    return;
  }
  if (catalog) {
    for (const sig of catalog) {
      const trait = sig.traits.find((t) =>
        t.overridableConfigKeys.some((p) => p.key === 'ownerField'),
      );
      if (trait) {
        writeOwnerField(trait.name, entry.ownerField, params);
        return;
      }
    }
  }
  warnings.push({
    field: `ruleOverlay.ownership.${entry.entity}`,
    reason: 'no trait in the bound signature or catalog advertises an `ownerField` config knob',
  });
}

function writeOwnerField(
  traitName: string,
  ownerField: string,
  params: FactoryCallSiteParams,
): void {
  const existing = params.traitOverrides?.[traitName] ?? {};
  const existingConfig = existing.config ?? {};
  params.traitOverrides = {
    ...params.traitOverrides,
    [traitName]: {
      ...existing,
      config: { ...existingConfig, ownerField },
    },
  };
}

function navItemToParamValue(item: PresentationNavItem): FactoryParamValue {
  const out: Record<string, FactoryParamValue> = {
    label: item.label,
    path: item.path,
  };
  if (item.icon) out.icon = item.icon;
  return out;
}
