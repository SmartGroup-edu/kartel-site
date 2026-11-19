// «Кто уже с нами» (bus 84/97 item 3). Pure, unit-tested.
// The family line counts the same thing as the prod gate (plan §9.1: every member ticks routines for a
// week): members with at least one routine ticked done this week, Monday up to today. It is ONE family
// number — never a per-person or per-child count (Floor №8).
export function familyWeek(people, routines, checks, weekStart, today) {
  const owner = new Map(routines.map((r) => [r.id, r.person_id]));
  const active = new Set();
  for (const c of checks) if (c.done && c.on_date >= weekStart && c.on_date <= today && owner.has(c.routine_id)) active.add(owner.get(c.routine_id));
  const ids = new Set(people.map((p) => p.id));
  return { active: [...active].filter((id) => ids.has(id)).length, of: people.length };
}

/** One row per person: sign-in dates, digest setting, passkey state, last invite. No activity numbers. */
export function adoptionRows(people, seen, prefs, invites, passkeys = null) {
  const byEmail = new Map(seen.map((s) => [s.email, s]));
  const inv = new Map(invites.map((i) => [i.person_id, i]));
  return people.map((p) => {
    const s = byEmail.get(p.email), pr = prefs.get(p.id), i = inv.get(p.id);
    return {
      id: p.id, name_en: p.name_en, name_ru: p.name_ru, kind: p.kind,
      signed_in: s ? { first_on: s.first_on, last_on: s.last_on } : null,
      digest: { on: pr ? pr.email_on : true, time: pr?.digest_time ?? "07:00" },
      passkey: passkeys ? passkeys.has(p.email) : null, // null = passkeys not built yet (bus 98, in security review)
      invite: i ? { on_date: i.on_date, sent: Boolean(i.sent_at), sent_at: i.sent_at ? new Date(i.sent_at).toISOString() : null } : null,
    };
  });
}
