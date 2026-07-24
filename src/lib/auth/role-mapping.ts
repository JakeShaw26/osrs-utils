import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { isClanTier, type RoleMapping } from './tiers';

/**
 * Loads the Discord role ID -> clan tier mapping from `clan_config`.
 *
 * Config, not code (PRD §5.4): role IDs differ per guild and change when the
 * clan reorganises its ranks, and neither should require a deploy.
 *
 * Fails closed in every direction. An unreadable, missing, or malformed
 * mapping yields `{}`, and `resolveTier({})` returns `guest` — so a database
 * problem locks people out rather than letting them in. Entries that do not
 * parse are dropped individually, so one bad row cannot corrupt the rest.
 */

export const ROLE_MAPPING_KEY = 'discord_role_mapping';

export async function loadRoleMapping(): Promise<RoleMapping> {
  try {
    const rows = await getDb()
      .select()
      .from(schema.clanConfig)
      .where(eq(schema.clanConfig.key, ROLE_MAPPING_KEY))
      .limit(1);

    return parseRoleMapping(rows[0]?.value);
  } catch (error) {
    console.error('[auth] failed to load role mapping — denying by default', error);
    return {};
  }
}

/** Exported for testing: validation of untrusted config data. */
export function parseRoleMapping(value: unknown): RoleMapping {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const mapping: Record<string, ReturnType<typeof asTier>> = {};

  for (const [roleId, tier] of Object.entries(value)) {
    // Discord snowflakes are numeric strings; anything else is not a role ID.
    if (!/^\d{1,20}$/.test(roleId)) continue;
    const parsed = asTier(tier);
    if (parsed) mapping[roleId] = parsed;
  }

  return mapping as RoleMapping;
}

function asTier(value: unknown) {
  return isClanTier(value) ? value : null;
}
