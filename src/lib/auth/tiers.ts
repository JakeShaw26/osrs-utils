/**
 * Clan permission tiers and Discord role mapping.
 *
 * Pure logic, no I/O — so the security-critical decisions here are unit
 * testable without a database, a network, or a rendered component. That is
 * deliberate: this is the code most worth having tests for. (PRD §5.4)
 */

/** Ordered lowest to highest. Must match the `clan_role` enum in db/schema.ts. */
export const CLAN_TIERS = ['guest', 'applicant', 'member', 'officer', 'admin'] as const;

export type ClanTier = (typeof CLAN_TIERS)[number];

const TIER_RANK: Record<ClanTier, number> = {
  guest: 0,
  applicant: 1,
  member: 2,
  officer: 3,
  admin: 4,
};

/** The tier granted when nothing else applies. Never change this to anything higher. */
export const DEFAULT_TIER: ClanTier = 'guest';

/** True if `actual` meets or exceeds `required`. */
export function meetsTier(actual: ClanTier, required: ClanTier): boolean {
  return TIER_RANK[actual] >= TIER_RANK[required];
}

/** Tiers that may perform privileged actions — these always revalidate. (PRD §5.2) */
export function isPrivilegedTier(tier: ClanTier): boolean {
  return meetsTier(tier, 'officer');
}

/**
 * Discord role ID -> clan tier. Stored in `clan_config`, never hardcoded, so
 * the mapping can change without a deploy. (PRD §5.4)
 */
export type RoleMapping = Readonly<Record<string, ClanTier>>;

/**
 * Resolves a member's tier from their Discord role IDs.
 *
 * Two properties that matter more than they look:
 *
 * 1. **Highest wins.** A user holding both Member and Officer roles is an
 *    Officer. Taking the first match instead would make the result depend on
 *    Discord's array ordering, which we do not control.
 * 2. **Unknown roles are ignored, never inherited.** An unmapped role
 *    contributes nothing, so adding a new Discord role can never accidentally
 *    grant access. Absent any mapped role the answer is `guest` — the floor,
 *    not an error and not an escalation.
 */
export function resolveTier(roleIds: readonly string[], mapping: RoleMapping): ClanTier {
  let best: ClanTier = DEFAULT_TIER;

  for (const roleId of roleIds) {
    const tier = mapping[roleId];
    if (tier && TIER_RANK[tier] > TIER_RANK[best]) {
      best = tier;
    }
  }

  return best;
}

/** Type guard for values arriving from the database or config. */
export function isClanTier(value: unknown): value is ClanTier {
  return typeof value === 'string' && (CLAN_TIERS as readonly string[]).includes(value);
}
