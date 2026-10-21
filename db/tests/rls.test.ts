import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;

/** One transaction per test, always rolled back, so tests never leak state into each other. */
class Tx {
  private constructor(private c: Client) {}

  static async begin(): Promise<Tx> {
    const c = new Client({ connectionString: DATABASE_URL });
    await c.connect();
    await c.query("begin");
    return new Tx(c);
  }

  /** Act as the database owner (bypasses RLS) for seeding and assertions. */
  async admin() {
    await this.c.query("reset role");
    await this.c.query("select set_config('request.jwt.claim.sub', '', true)");
  }

  /** Act as a signed-in user, exactly like Supabase does for API requests. */
  async as(userId: string) {
    await this.c.query("reset role");
    await this.c.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await this.c.query("set local role authenticated");
  }

  async anon() {
    await this.c.query("reset role");
    await this.c.query("select set_config('request.jwt.claim.sub', '', true)");
    await this.c.query("set local role anon");
  }

  async q<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return this.c.query<T & Record<string, unknown>>(sql, params);
  }

  /** Assert that a statement is rejected; uses a savepoint so the transaction stays usable. */
  async fails(sql: string, params: unknown[], message: RegExp) {
    await this.c.query("savepoint expect_fail");
    try {
      await this.c.query(sql, params);
    } catch (e) {
      await this.c.query("rollback to savepoint expect_fail");
      expect(String((e as Error).message)).toMatch(message);
      return;
    }
    await this.c.query("release savepoint expect_fail");
    throw new Error(`Expected statement to fail but it succeeded: ${sql}`);
  }

  async end() {
    await this.c.query("rollback");
    await this.c.end();
  }
}

const RLS = /row-level security|permission denied/i;

describe.skipIf(!DATABASE_URL)("database security (RLS)", () => {
  let tx: Tx;
  let A: string;
  let B: string;
  let C: string;
  let placeId: string;

  beforeEach(async () => {
    tx = await Tx.begin();
    A = randomUUID();
    B = randomUUID();
    C = randomUUID();
    for (const [id, name] of [[A, "Asha"], [B, "Bala"], [C, "Chitra"]]) {
      await tx.q(
        "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
        [id, `${name.toLowerCase()}@example.test`, JSON.stringify({ full_name: name })],
      );
    }
    const p = await tx.q<{ id: string }>(
      "insert into public.places (google_place_id, name_cache, created_by) values ($1, 'Test Biryani', $2) returning id",
      [`gp_${randomUUID()}`, A],
    );
    placeId = p.rows[0].id;
  });

  afterEach(async () => {
    await tx.end();
  });

  /** A owns a list; B joins with the given role through a real invite. */
  async function shareListWith(userId: string, role: "editor" | "viewer") {
    await tx.as(A);
    const list = await tx.q<{ id: string }>(
      "insert into public.lists (owner_id, name) values ($1, 'Family weekend') returning id",
      [A],
    );
    const listId = list.rows[0].id;
    const inv = await tx.q<{ token: string }>("select public.create_invite($1, $2, 72) as token", [listId, role]);
    await tx.as(userId);
    await tx.q("select public.accept_invite($1)", [inv.rows[0].token]);
    return { listId, token: inv.rows[0].token };
  }

  it("creates a profile automatically on signup", async () => {
    await tx.admin();
    const r = await tx.q("select display_name from public.profiles where id = $1", [A]);
    expect(r.rows[0].display_name).toBe("Asha");
  });

  it("keeps user_places private: others see nothing and cannot change or delete", async () => {
    await tx.as(A);
    const ins = await tx.q<{ id: string }>(
      "insert into public.user_places (user_id, place_id, status, notes) values ($1, $2, 'want', 'secret note') returning id",
      [A, placeId],
    );
    const id = ins.rows[0].id;

    await tx.as(B);
    expect((await tx.q("select * from public.user_places")).rowCount).toBe(0);
    expect((await tx.q("update public.user_places set notes = 'hacked' where id = $1", [id])).rowCount).toBe(0);
    expect((await tx.q("delete from public.user_places where id = $1", [id])).rowCount).toBe(0);

    await tx.admin();
    const still = await tx.q("select notes from public.user_places where id = $1", [id]);
    expect(still.rows[0].notes).toBe("secret note");
  });

  it("keeps visits private", async () => {
    await tx.as(A);
    await tx.q("insert into public.visits (user_id, place_id, rating, dishes) values ($1, $2, 5, 'mutton biryani')", [A, placeId]);
    await tx.as(B);
    expect((await tx.q("select * from public.visits")).rowCount).toBe(0);
    await tx.as(A);
    expect((await tx.q("select * from public.visits")).rowCount).toBe(1);
  });

  it("rejects writing rows on behalf of another user", async () => {
    await tx.as(A);
    await tx.fails("insert into public.user_places (user_id, place_id) values ($1, $2)", [B, placeId], RLS);
    await tx.fails("insert into public.visits (user_id, place_id) values ($1, $2)", [B, placeId], RLS);
  });

  it("does not let a user re-assign ownership of their own rows (column privileges)", async () => {
    await tx.as(A);
    const ins = await tx.q<{ id: string }>(
      "insert into public.user_places (user_id, place_id) values ($1, $2) returning id",
      [A, placeId],
    );
    await tx.fails("update public.user_places set user_id = $1 where id = $2", [B, ins.rows[0].id], RLS);
  });

  it("shared place catalogue: readable and insertable by signed-in users, never editable, closed to anon", async () => {
    await tx.as(B);
    expect((await tx.q("select * from public.places")).rowCount).toBeGreaterThan(0);
    await tx.q("insert into public.places (google_place_id, name_cache, created_by) values ('gp_new_place', 'New', $1)", [B]);
    await tx.fails("insert into public.places (google_place_id, created_by) values ('gp_forged', $1)", [A], RLS);
    await tx.fails("update public.places set name_cache = 'renamed' where id = $1", [placeId], RLS);
    await tx.fails("delete from public.places where id = $1", [placeId], RLS);
    await tx.anon();
    await tx.fails("select * from public.places", [], RLS);
  });

  it("anonymous users cannot touch private tables", async () => {
    await tx.anon();
    await tx.fails("select * from public.user_places", [], RLS);
    await tx.fails("select * from public.visits", [], RLS);
    await tx.fails("select * from public.lists", [], RLS);
  });

  it("lists: owner becomes a member automatically; outsiders cannot see the list or roster", async () => {
    await tx.as(A);
    const l = await tx.q<{ id: string }>("insert into public.lists (owner_id, name) values ($1, 'Mine') returning id", [A]);
    const members = await tx.q("select user_id, role from public.list_members where list_id = $1", [l.rows[0].id]);
    expect(members.rows).toEqual([{ user_id: A, role: "owner" }]);

    await tx.as(B);
    expect((await tx.q("select * from public.lists")).rowCount).toBe(0);
    expect((await tx.q("select * from public.list_members")).rowCount).toBe(0);
    await tx.fails("insert into public.lists (owner_id, name) values ($1, 'Fake')", [A], RLS);
  });

  it("cannot add yourself to someone else's list directly", async () => {
    await tx.as(A);
    const l = await tx.q<{ id: string }>("insert into public.lists (owner_id, name) values ($1, 'Mine') returning id", [A]);
    await tx.as(B);
    await tx.fails("insert into public.list_members (list_id, user_id, role) values ($1, $2, 'editor')", [l.rows[0].id, B], RLS);
  });

  it("invites: only the owner can create; token is stored hashed; single use; expiry and owner role enforced", async () => {
    await tx.as(A);
    const l = await tx.q<{ id: string }>("insert into public.lists (owner_id, name) values ($1, 'Mine') returning id", [A]);
    const listId = l.rows[0].id;
    const inv = await tx.q<{ token: string }>("select public.create_invite($1, 'editor', 72) as token", [listId]);
    const token = inv.rows[0].token;
    expect(token.length).toBeGreaterThanOrEqual(60);

    await tx.admin();
    const stored = await tx.q<{ token_hash: string }>("select token_hash from public.invites where list_id = $1", [listId]);
    expect(stored.rows[0].token_hash).not.toBe(token);
    expect(stored.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);

    await tx.as(B);
    await tx.fails("select public.create_invite($1, 'viewer', 72)", [listId], /only the list owner/);
    await tx.q("select public.accept_invite($1)", [token]);
    const roster = await tx.q("select role from public.list_members where user_id = $1", [B]);
    expect(roster.rows[0].role).toBe("editor");

    await tx.as(C);
    await tx.fails("select public.accept_invite($1)", [token], /invalid or expired/);

    await tx.as(A);
    await tx.fails("select public.create_invite($1, 'owner', 72)", [listId], /cannot invite as owner|invalid input|22023/);
    const second = await tx.q<{ token: string }>("select public.create_invite($1, 'viewer', 1) as token", [listId]);
    await tx.admin();
    await tx.q("update public.invites set expires_at = now() - interval '1 hour' where token_hash <> $1", [stored.rows[0].token_hash]);
    await tx.as(C);
    await tx.fails("select public.accept_invite($1)", [second.rows[0].token], /invalid or expired/);
    await tx.fails("select public.accept_invite('not-a-real-token')", [], /invalid or expired/);
  });

  it("invites table is invisible to non-owners", async () => {
    const { listId } = await shareListWith(B, "editor");
    await tx.as(B);
    expect((await tx.q("select * from public.invites where list_id = $1", [listId])).rowCount).toBe(0);
    await tx.as(A);
    expect((await tx.q("select * from public.invites where list_id = $1", [listId])).rowCount).toBe(1);
  });

  it("list roles: editors can add items, viewers cannot, outsiders see nothing", async () => {
    const { listId } = await shareListWith(B, "editor");
    await tx.as(B);
    await tx.q("insert into public.list_items (list_id, place_id, added_by) values ($1, $2, $3)", [listId, placeId, B]);
    await tx.fails("insert into public.list_items (list_id, place_id, added_by) values ($1, $2, $3)", [listId, placeId, A], RLS);

    await tx.as(C);
    expect((await tx.q("select * from public.list_items")).rowCount).toBe(0);
    await tx.fails("insert into public.list_items (list_id, place_id, added_by) values ($1, $2, $3)", [listId, placeId, C], RLS);
  });

  it("viewers cannot write list items", async () => {
    const { listId } = await shareListWith(B, "viewer");
    await tx.as(B);
    expect((await tx.q("select * from public.list_items where list_id = $1", [listId])).rowCount).toBe(0);
    await tx.fails("insert into public.list_items (list_id, place_id, added_by) values ($1, $2, $3)", [listId, placeId, B], RLS);
  });

  it("sharing a list does NOT expose a member's private notes or visits", async () => {
    const { listId } = await shareListWith(B, "editor");
    await tx.as(A);
    await tx.q("insert into public.user_places (user_id, place_id, notes) values ($1, $2, 'only for me')", [A, placeId]);
    await tx.q("insert into public.visits (user_id, place_id, notes) values ($1, $2, 'private visit')", [A, placeId]);
    await tx.as(B);
    expect((await tx.q("select * from public.user_places")).rowCount).toBe(0);
    expect((await tx.q("select * from public.visits")).rowCount).toBe(0);
    expect(listId).toBeTruthy();
  });

  it("profiles: visible only to yourself and co-members; only editable by the owner of the profile", async () => {
    await tx.as(B);
    expect((await tx.q("select id from public.profiles where id = $1", [A])).rowCount).toBe(0);

    await shareListWith(B, "viewer");
    await tx.as(B);
    expect((await tx.q("select id from public.profiles where id = $1", [A])).rowCount).toBe(1);
    expect((await tx.q("update public.profiles set display_name = 'hacked' where id = $1", [A])).rowCount).toBe(0);
    await tx.q("update public.profiles set display_name = 'Bala K' where id = $1", [B]);
    await tx.fails("update public.profiles set id = $1 where id = $2", [randomUUID(), B], RLS);

    await tx.as(C);
    expect((await tx.q("select id from public.profiles where id = $1", [A])).rowCount).toBe(0);
  });

  it("members: viewers cannot remove others; anyone can leave; owner row is protected; no promotion to owner", async () => {
    const { listId } = await shareListWith(B, "editor");
    // add C as viewer through a second invite
    await tx.as(A);
    const inv = await tx.q<{ token: string }>("select public.create_invite($1, 'viewer', 72) as token", [listId]);
    await tx.as(C);
    await tx.q("select public.accept_invite($1)", [inv.rows[0].token]);

    await tx.as(C);
    expect((await tx.q("delete from public.list_members where list_id = $1 and user_id = $2", [listId, B])).rowCount).toBe(0);

    await tx.as(A);
    expect((await tx.q("delete from public.list_members where list_id = $1 and user_id = $2", [listId, A])).rowCount).toBe(0);
    await tx.fails("update public.list_members set role = 'owner' where list_id = $1 and user_id = $2", [listId, B], RLS);
    expect((await tx.q("update public.list_members set role = 'viewer' where list_id = $1 and user_id = $2", [listId, B])).rowCount).toBe(1);

    await tx.as(C);
    expect((await tx.q("delete from public.list_members where list_id = $1 and user_id = $2", [listId, C])).rowCount).toBe(1);
    expect((await tx.q("select * from public.lists")).rowCount).toBe(0);

    await tx.as(A);
    expect((await tx.q("delete from public.list_members where list_id = $1 and user_id = $2", [listId, B])).rowCount).toBe(1);
  });

  it("only the owner can rename or delete a list", async () => {
    const { listId } = await shareListWith(B, "editor");
    await tx.as(B);
    expect((await tx.q("update public.lists set name = 'mine now' where id = $1", [listId])).rowCount).toBe(0);
    expect((await tx.q("delete from public.lists where id = $1", [listId])).rowCount).toBe(0);
    await tx.as(A);
    expect((await tx.q("update public.lists set name = 'Renamed' where id = $1", [listId])).rowCount).toBe(1);
    await tx.fails("update public.lists set owner_id = $1 where id = $2", [B, listId], RLS);
    expect((await tx.q("delete from public.lists where id = $1", [listId])).rowCount).toBe(1);
  });

  it("recommendations: only between people who share a list; recipient can change status only; outsiders see nothing", async () => {
    await tx.as(A);
    await tx.fails("insert into public.recommendations (from_user, to_user, place_id) values ($1, $2, $3)", [A, B, placeId], RLS);

    await shareListWith(B, "viewer");
    await tx.as(A);
    const rec = await tx.q<{ id: string }>(
      "insert into public.recommendations (from_user, to_user, place_id, message) values ($1, $2, $3, 'Try the biryani') returning id",
      [A, B, placeId],
    );
    const id = rec.rows[0].id;
    await tx.fails("insert into public.recommendations (from_user, to_user, place_id) values ($1, $2, $3)", [B, A, placeId], RLS);

    await tx.as(B);
    expect((await tx.q("select * from public.recommendations")).rowCount).toBe(1);
    await tx.q("update public.recommendations set status = 'accepted' where id = $1", [id]);
    await tx.fails("update public.recommendations set message = 'rewritten' where id = $1", [id], RLS);
    await tx.fails("update public.recommendations set from_user = $1 where id = $2", [C, id], RLS);

    await tx.as(C);
    expect((await tx.q("select * from public.recommendations")).rowCount).toBe(0);
    expect((await tx.q("update public.recommendations set status = 'dismissed' where id = $1", [id])).rowCount).toBe(0);
  });

  it("quota: allows up to the daily cap, then refuses; counters cannot be edited directly", async () => {
    await tx.as(A);
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await tx.q<{ ok: boolean }>("select public.consume_quota('places_search', 2) as ok");
      results.push(r.rows[0].ok);
    }
    expect(results).toEqual([true, true, false, false]);
    const row = await tx.q<{ count: number }>("select count from public.api_usage where kind = 'places_search'");
    expect(row.rows[0].count).toBe(2);
    await tx.fails("update public.api_usage set count = 0", [], RLS);
    await tx.fails("insert into public.api_usage (user_id, kind, count) values ($1, 'link_parse', 0)", [A], RLS);
    await tx.fails("select public.consume_quota('made_up_kind', 5)", [], /check constraint|violates/i);

    await tx.as(B);
    expect((await tx.q("select * from public.api_usage")).rowCount).toBe(0);
    expect((await tx.q<{ ok: boolean }>("select public.consume_quota('places_search', 2) as ok")).rows[0].ok).toBe(true);
  });

  it("export_my_data returns only the caller's own data", async () => {
    await tx.as(A);
    await tx.q("insert into public.user_places (user_id, place_id, notes) values ($1, $2, 'mine')", [A, placeId]);
    await tx.as(B);
    await tx.q("insert into public.user_places (user_id, place_id, notes) values ($1, $2, 'theirs')", [B, placeId]);
    await tx.q("insert into public.visits (user_id, place_id) values ($1, $2)", [B, placeId]);

    await tx.as(A);
    const r = await tx.q<{ data: { user_places: { notes: string }[]; visits: unknown[]; profile: { id: string } } }>(
      "select public.export_my_data() as data",
    );
    const data = r.rows[0].data;
    expect(data.profile.id).toBe(A);
    expect(data.user_places).toHaveLength(1);
    expect(data.user_places[0].notes).toBe("mine");
    expect(data.visits).toHaveLength(0);
  });

  it("deleting an account removes the person's data but keeps the shared catalogue", async () => {
    await tx.as(A);
    await tx.q("insert into public.user_places (user_id, place_id) values ($1, $2)", [A, placeId]);
    await tx.q("insert into public.visits (user_id, place_id) values ($1, $2)", [A, placeId]);
    await tx.q("insert into public.lists (owner_id, name) values ($1, 'Mine')", [A]);

    await tx.admin();
    await tx.q("delete from auth.users where id = $1", [A]);
    for (const table of ["user_places", "visits"]) {
      expect((await tx.q(`select 1 from public.${table} where user_id = $1`, [A])).rowCount).toBe(0);
    }
    expect((await tx.q("select 1 from public.profiles where id = $1", [A])).rowCount).toBe(0);
    expect((await tx.q("select 1 from public.lists where owner_id = $1", [A])).rowCount).toBe(0);
    expect((await tx.q("select 1 from public.places where id = $1", [placeId])).rowCount).toBe(1);
  });

  it("enforces data limits at the database level", async () => {
    await tx.as(A);
    await tx.fails("insert into public.visits (user_id, place_id, rating) values ($1, $2, 6)", [A, placeId], /check constraint|violates/i);
    await tx.fails("insert into public.visits (user_id, place_id, spend_inr) values ($1, $2, -5)", [A, placeId], /check constraint|violates/i);
    await tx.fails("insert into public.lists (owner_id, name) values ($1, '')", [A], /check constraint|violates/i);
    await tx.fails("insert into public.user_places (user_id, place_id, notes) values ($1, $2, $3)", [A, placeId, "x".repeat(4001)], /check constraint|violates/i);
  });
});
