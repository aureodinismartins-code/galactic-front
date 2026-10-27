/* THE FRONT PAGE: one newspaper for the whole war.

   Two halves:

     - the SQL, against real PostgreSQL (PGlite): who may write the paper,
       who may only file a dispatch, what waits in the editor's tray, what
       reaches the front page and what the reset does to it;
     - the widget, in jsdom: the reader, the leader's desk and the editor's
       desk, the picture desk, and a database without the patch.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/front-page-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const PATCH = "sql/2026-11-11_the_front_page.sql";
const NEWS = fs.readFileSync(path.join(ROOT, "news.js"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

const EDITOR = "11111111-1111-1111-1111-111111111111";     /* the host */
const PRESIDENT = "22222222-2222-2222-2222-222222222222";  /* the Authority's leader */
const COMMISSAR = "33333333-3333-3333-3333-333333333333";  /* the Combine's leader */
const READER = "44444444-4444-4444-4444-444444444444";     /* everybody else */
const NOBODY = "99999999-9999-9999-9999-999999999999";

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + String(extra).slice(0, 300) + "]" : "")); }
}

const SCHEMA = `
create schema if not exists auth;
create schema if not exists public;

do $do$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $do$;

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.game_control (id int primary key, host_player uuid, started boolean default true,
    maintenance boolean default false);
insert into public.game_control (id, host_player) values (1, '${EDITOR}');

create table public.players (id uuid primary key, faction text, username text);
insert into public.players values
    ('${EDITOR}', 'Freedom Authority', 'Ana Rocha'),
    ('${PRESIDENT}', 'Freedom Authority', 'President Hale'),
    ('${COMMISSAR}', 'Combine', 'Comrade Volkov'),
    ('${READER}', 'Independents', 'Nobody');

create table public.cg_state (id int primary key, president_player uuid, term_no int default 0, term_end timestamptz);
insert into public.cg_state (id, president_player, term_no, term_end)
values (1, '${PRESIDENT}', 2, now() + interval '3 days');

create table public.cs_state (id int primary key, secretary_player uuid, secretary_name text);
insert into public.cs_state (id, secretary_player, secretary_name)
values (1, '${COMMISSAR}', 'Comrade Volkov');
`;

async function as(db, who) {
    await db.exec("select set_config('test.me', '" + who + "', false)");
}

async function call(db, sql) {
    const r = await db.query(sql);
    return r.rows;
}

async function expectError(db, sql) {
    try { await db.query(sql); return null; }
    catch (e) { return String(e.message || e); }
}

const iso = (ms) => new Date(Date.now() + (ms || 0)).toISOString();

/* ------------------------------------------------------------------
   the database
   ------------------------------------------------------------------ */

async function sqlHalf() {

    console.log("the front page in the database");

    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(fs.readFileSync(path.join(ROOT, PATCH), "utf8"));

    const made = (await call(db, "select " +
        "(select count(*) from information_schema.tables where table_schema = 'public' " +
        " and table_name = 'news_articles')::int as tables, " +
        "(select count(*) from information_schema.routines where routine_schema = 'public' and routine_name in " +
        "('news_is_editor', 'news_leader_faction', 'news_office', 'news_cleaned', 'news_state', " +
        " 'news_write', 'news_publish', 'news_refuse', 'news_spike', 'news_pin', 'news_remove', " +
        " 'news_file', 'news_withdraw', 'news_clear_trays'))::int as functions, " +
        "(select count(*) from public.game_control as g join public.players as p on p.id = g.host_player " +
        " where g.id = 1)::int as editors"))[0];
    check("the paper's table is there", Number(made.tables) === 1, made.tables);
    check("with the fourteen rules that run it", Number(made.functions) === 14, made.functions);
    check("and the host is read as its editor", Number(made.editors) === 1, made.editors);

    console.log("\nanybody may read the paper; nobody else may write it");
    await as(db, READER);
    let st = (await call(db, "select public.news_state() as s"))[0].s;
    check("a commander gets the paper", st.is_editor === false && st.leader === null &&
        st.published.length === 0, JSON.stringify(st.published));
    check("and an empty tray", st.tray.length === 0 && Number(st.waiting) === 0, JSON.stringify(st.tray));

    let err = await expectError(db, "select public.news_file('A story')");
    check("a commander cannot file a dispatch", /Only a faction leader/.test(String(err)), err);
    err = await expectError(db, "select public.news_write('A story')");
    check("nor write the paper", /Only the host/.test(String(err)), err);
    err = await expectError(db, "select public.news_publish('" + NOBODY + "')");
    check("nor print anything", /Only the host/.test(String(err)), err);
    err = await expectError(db, "select public.news_clear_trays()");
    check("nor empty the trays", /Only the host/.test(String(err)), err);

    console.log("\nthe President of the Freedom Authority files a dispatch");
    await as(db, PRESIDENT);
    st = (await call(db, "select public.news_file('The line holds', 'Krieg stands', " +
        "'Two fleets met above Krieg and neither gave way.') as s"))[0].s;
    check("it waits on the leader's own desk", st.mine.length === 1 && st.mine[0].status === "pending",
        JSON.stringify(st.mine));
    check("and nowhere near the front page", st.published.length === 0 && Number(st.my_published) === 0,
        JSON.stringify(st.published));
    check("the leader's office is read off the Congress", st.leader === "Freedom Authority" &&
        st.office === "President of the Freedom Authority", st.office);
    const held = st.mine[0].id;

    console.log("\nwhat a story has to be");
    err = await expectError(db, "select public.news_file('')");
    check("a headline is demanded", /needs a headline/.test(String(err)), err);
    err = await expectError(db, "select public.news_file('Words', '', '')");
    check("and words under it", /needs some words/.test(String(err)), err);
    err = await expectError(db, "select public.news_file('Words', '', 'Words.', 'ftp://example.test/x.png')");
    check("a picture has to be a link", String(err).indexOf("http(s) link") !== -1, err);

    await call(db, "select public.news_file('Long', '', repeat('x', 7000))");
    st = (await call(db, "select public.news_state() as s"))[0].s;
    check("a story too long is cut to what a page holds",
        String(st.mine[0].body).length === 6000, String(st.mine[0].body).length);

    for (let i = 0; i < 3; i++) { await call(db, "select public.news_file('Filler " + i + "', '', 'Words.')"); }
    err = await expectError(db, "select public.news_file('One more')");
    check("five waiting is the whole allowance", /Five of your dispatches/.test(String(err)), err);

    console.log("\nthe Combine's High Commissar has the same desk");
    await as(db, COMMISSAR);
    st = (await call(db, "select public.news_state() as s"))[0].s;
    check("his office is read off the Soviet", st.leader === "Combine" &&
        st.office === "High Commissar of the Combine", st.office);
    check("and the two chairs are named for the paper", st.desks.authority === "President Hale" &&
        st.desks.combine === "Comrade Volkov", JSON.stringify(st.desks));
    await call(db, "select public.news_file('The plan is met', '', 'The five-year plan is met ahead of time.')");
    st = (await call(db, "select public.news_state() as s"))[0].s;
    check("the commissar's dispatch waits too", st.mine.length === 1 && st.published.length === 0,
        JSON.stringify(st.mine));

    console.log("\nthe editor reads the tray and decides");
    await as(db, EDITOR);
    st = (await call(db, "select public.news_state() as s"))[0].s;
    check("the editor sees both desks waiting", st.tray.length === 6 && Number(st.waiting) === 6,
        st.tray.length);
    check("with the byline and the office on each", st.tray[0].by === "President Hale" &&
        st.tray[0].office === "President of the Freedom Authority", JSON.stringify(st.tray[0]));
    check("and the paper is the editor's", st.is_editor === true);

    err = await expectError(db, "select public.news_file('The editor files a dispatch')");
    check("who writes the paper directly instead", /writes the paper directly/.test(String(err)), err);

    st = (await call(db, "select public.news_publish('" + held + "') as s"))[0].s;
    check("printing a dispatch puts it on the front page", st.published.length === 1 &&
        st.published[0].headline === "The line holds", JSON.stringify(st.published));
    check("signed by the desk that filed it", st.published[0].by === "President Hale" &&
        st.published[0].role === "leader" &&
        st.published[0].office === "President of the Freedom Authority", JSON.stringify(st.published[0]));
    check("and the tray is one shorter", st.tray.length === 5 && Number(st.waiting) === 5, st.tray.length);

    err = await expectError(db, "select public.news_refuse('" + held + "', 'no')");
    check("what is already printed cannot be refused", /not in the tray/.test(String(err)), err);

    await call(db, "select public.news_refuse('" + st.tray[0].id + "', 'Thin stuff. Bring me numbers.')");
    st = (await call(db, "select public.news_state() as s"))[0].s;
    check("turning one down takes it out of the tray", st.tray.length === 4, st.tray.length);

    await as(db, PRESIDENT);
    st = (await call(db, "select public.news_state() as s"))[0].s;
    const turned = st.mine.filter(m => m.status === "refused")[0];
    check("and the desk that filed it is told why", turned && /Bring me numbers/.test(turned.note),
        turned && turned.note);
    check("while what was printed counts on their desk", Number(st.my_published) === 1, st.my_published);

    err = await expectError(db, "select public.news_publish('" + held + "')");
    check("a leader cannot print their own dispatch", /Only the host/.test(String(err)), err);
    err = await expectError(db, "select public.news_write('Mine now')");
    check("nor write the paper", /Only the host/.test(String(err)), err);

    console.log("\nthe editor writes the paper directly");
    await as(db, EDITOR);
    st = (await call(db, "select public.news_write('War opens on three fronts', " +
        "'The galaxy wakes to gunfire', 'Fleets left their moorings at dawn.') as s"))[0].s;
    check("a story of the editor's own is printed at once", st.published.length === 2 &&
        st.published[0].by === "Ana Rocha", JSON.stringify(st.published.map(a => a.headline)));
    const own = st.published[0].id;

    st = (await call(db, "select public.news_write('War opens on four fronts', '', " +
        "'Fleets left their moorings at dawn.', null, null, '" + own + "') as s"))[0].s;
    const edited = st.published.filter(a => a.id === own)[0];
    check("and can be rewritten in the paper",
        edited.headline === "War opens on four fronts" && edited.edited === true, JSON.stringify(edited));

    console.log("\nthe lead story, the spike and the fire");
    const filed = st.published.filter(a => a.role === "leader")[0];
    st = (await call(db, "select public.news_pin('" + filed.id + "') as s"))[0].s;
    check("the lead story stands above the rest",
        st.published[0].id === filed.id && st.published[0].pinned === true,
        JSON.stringify(st.published.map(a => a.headline)));
    st = (await call(db, "select public.news_pin('" + filed.id + "', false) as s"))[0].s;
    check("and can be stood down again",
        st.published[0].id !== filed.id && st.published[0].pinned === false,
        JSON.stringify(st.published.map(a => a.pinned)));

    st = (await call(db, "select public.news_spike('" + own + "') as s"))[0].s;
    check("a spiked story leaves the page", st.published.length === 1, st.published.length);
    check("and waits in the drawer", (st.mine || []).filter(m => m.id === own && m.status === "draft").length === 1,
        JSON.stringify(st.mine));

    st = (await call(db, "select public.news_remove('" + filed.id + "') as s"))[0].s;
    check("and a story can be burned", st.published.length === 0, st.published.length);
    err = await expectError(db, "select public.news_remove('" + NOBODY + "')");
    check("burning what is not there is refused", /not in the paper/.test(String(err)), err);

    console.log("\ntaking a dispatch back");
    await as(db, PRESIDENT);
    st = (await call(db, "select public.news_state() as s"))[0].s;
    const waiting = st.mine.filter(m => m.status === "pending")[0];
    st = (await call(db, "select public.news_withdraw('" + waiting.id + "') as s"))[0].s;
    check("a leader may take back what is still waiting",
        st.mine.filter(m => m.id === waiting.id).length === 0, JSON.stringify(st.mine));

    console.log("\nthe reset empties the trays and keeps the paper");
    await as(db, EDITOR);
    st = (await call(db, "select public.news_write('The archive', '', 'Yesterday''s paper.') as s"))[0].s;
    const printed = st.published.length;
    const cleared = (await call(db, "select public.news_clear_trays() as r"))[0].r;
    check("the trays are emptied", Number(cleared.cleared) >= 1 && Number(cleared.printed) === printed,
        JSON.stringify(cleared));
    st = (await call(db, "select public.news_state() as s"))[0].s;
    check("and what was printed stays", st.published.length === printed && st.tray.length === 0,
        st.published.length + " / " + st.tray.length);

    console.log("\nand a screen that is not signed in reads nothing");
    await db.exec("select set_config('test.me', '', false)");
    err = await expectError(db, "select public.news_state()");
    check("the paper is refused", /Not authenticated/.test(String(err)), err);
    err = await expectError(db, "select public.news_file('Anonymous')");
    check("and so is filing", /Not authenticated/.test(String(err)), err);

}

/* ------------------------------------------------------------------
   the page
   ------------------------------------------------------------------ */

function stateOf(extra) {
    return Object.assign({
        now: iso(), is_editor: false, leader: null, office: null, me: "Nobody",
        my_faction: "Independents", desks: { authority: "President Hale" },
        published: [LEAD], tray: [], waiting: 0, mine: [], my_published: 0
    }, extra || {});
}

const LEAD = { id: "p1", headline: "War opens on three fronts", standfirst: "The galaxy wakes to gunfire",
    body: "Fleets left their moorings at dawn.", image: "https://cdn.test/news/one.png",
    caption: "The line at Krieg", by: "Ana Rocha", office: null, role: "editor",
    faction: null, pinned: false, published_at: iso(-60000), edited: false, mine: false };

const FILED = { id: "d1", headline: "The line holds", standfirst: "Krieg stands",
    body: "Two fleets met above Krieg.", image: null, caption: null, by: "President Hale",
    office: "President of the Freedom Authority", faction: "Freedom Authority",
    submitted_at: iso(-3600000) };

const TURNED = { id: "d0", headline: "We need numbers", standfirst: "", body: "",
    status: "refused", note: "Not this week", submitted_at: iso(-7200000) };

function page(opts) {

    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", function() {});
    virtualConsole.on("error", function() {});

    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/galaxy.html",
        runScripts: "dangerously",
        pretendToBeVisual: true,
        virtualConsole: virtualConsole
    });

    const w = dom.window;
    const calls = [];

    w.gameStatus = { is_host: !!opts.host };
    w.prompt = function() { return "Not this week"; };
    w.supabaseClient = {
        rpc: function(name, args) {
            calls.push({ name: name, args: args || {} });
            if (name === "news_state" && opts.missing) {
                return Promise.resolve({ data: null, error: { message:
                    "Could not find the function public.news_state in the schema cache" } });
            }
            return Promise.resolve({ data: opts.state || null, error: null });
        },
        storage: opts.storage
    };

    w.eval(NEWS);

    return { w: w, calls: calls };

}

const tick = () => new Promise(r => setTimeout(r, 30));
const named = (calls, name) => calls.filter(c => c.name === name);
const last = (calls, name) => {
    const all = named(calls, name);
    return all[all.length - 1];
};

function panel(p) { return p.w.document.getElementById("gf-news-panel"); }
function el(p, sel) {
    const found = panel(p).querySelector(sel);
    if (!found) { throw new Error("no " + sel + " in " + panel(p).textContent.slice(0, 200)); }
    return found;
}
function click(p, sel) {
    const found = el(p, sel);
    found.dispatchEvent(new p.w.MouseEvent("click", { bubbles: true }));
    return found;
}
function type(p, sel, value) {
    const found = el(p, sel);
    found.value = value;
    found.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    return found;
}
async function open(p) {
    p.w.GFNews.open();
    await tick();
}

async function widgetHalf() {

    console.log("\n\nthe front page on the page");

    console.log("a commander reads the paper");

    const reader = page({ host: false, state: stateOf({}) });
    await tick(); await tick();

    check("the paper's button is on the screen", !!reader.w.document.getElementById("gf-news-button"));
    await open(reader);

    const read = panel(reader).textContent;
    check("the masthead names the paper", /THE GALACTIC FRONT/.test(read), read.slice(0, 120));
    check("the lead story is on the front page", /War opens on three fronts/.test(read) &&
        /Fleets left their moorings at dawn/.test(read), read.slice(0, 400));
    check("signed, with the office that wrote it", /by Ana Rocha, the editor/.test(read), read.slice(0, 400));
    check("and the picture with its caption", /The line at Krieg/.test(read) &&
        /cdn\.test\/news\/one\.png/.test(panel(reader).innerHTML));
    check("a reader has no pen", !/PUBLISH IT|WRITE THE STORY|SEND IT TO THE EDITOR/.test(read), read.slice(0, 300));
    check("and no tray", !/THE EDITOR'S TRAY/.test(read), read.slice(0, 200));

    console.log("\nthe leader's desk files a dispatch");

    const leader = page({ host: false, state: stateOf({
        leader: "Freedom Authority", office: "President of the Freedom Authority",
        me: "President Hale", my_faction: "Freedom Authority",
        mine: [TURNED], my_published: 1
    }) });
    await tick(); await tick();
    await open(leader);

    check("the desk is offered to the leader", /FILE A DISPATCH/.test(panel(leader).textContent),
        panel(leader).textContent.slice(0, 200));

    click(leader, '[data-gf="tab"][data-t="file"]');
    await tick();

    const desk = () => panel(leader).textContent;
    check("what was turned down is on it, with the editor's note",
        /We need numbers/.test(desk()) && /Not this week/.test(desk()), desk().slice(0, 400));
    check("and what was printed is counted", /1 of your dispatches is on the front page/.test(desk()),
        desk().slice(0, 400));

    await click(leader, '[data-gf="file"]');
    await tick();
    check("an empty dispatch never leaves the screen", !last(leader.calls, "news_file"),
        JSON.stringify(named(leader.calls, "news_file")));
    check("and the desk is told what is missing", /A story needs a headline/.test(desk()), desk().slice(0, 200));

    type(leader, '[data-gf="headline"]', "Krieg holds");
    type(leader, '[data-gf="body"]', "Two fleets met above Krieg and neither gave way.");
    click(leader, '[data-gf="file"]');
    await tick();

    let sent = last(leader.calls, "news_file");
    check("filing sends the words to the editor", !!sent && sent.args.p_headline === "Krieg holds" &&
        /neither gave way/.test(sent.args.p_body), JSON.stringify(sent && sent.args));

    check("and the leader may take a waiting dispatch back",
        !!el(leader, '[data-gf="withdraw"]'), desk().slice(0, 200));

    console.log("\nthe editor's desk writes the paper");

    const uploaded = [];

    const editor = page({ host: true, storage: {
        from: function(bucket) {
            return {
                upload: function(filePath, file) {
                    uploaded.push({ bucket: bucket, path: filePath, file: file });
                    return Promise.resolve({ data: { path: filePath }, error: null });
                },
                getPublicUrl: function(filePath) {
                    return { data: { publicUrl: "https://cdn.test/news/" + filePath } };
                }
            };
        }
    }, state: stateOf({ is_editor: true, me: "Ana Rocha", tray: [FILED], waiting: 1 }) });

    await tick(); await tick();
    await open(editor);

    check("the desk is offered to the editor", /EDITOR'S DESK/.test(panel(editor).textContent) &&
        /EDITOR'S DESK \(1\)/.test(panel(editor).textContent), panel(editor).textContent.slice(0, 200));

    click(editor, '[data-gf="tab"][data-t="desk"]');
    await tick();

    const tray = () => panel(editor).textContent;
    check("the tray holds what the leader filed", /The line holds/.test(tray()) &&
        /President of the Freedom Authority/.test(tray()), tray().slice(0, 400));

    await click(editor, '[data-gf="print"]');
    await tick();
    check("printing it is the editor's call alone",
        !!last(editor.calls, "news_publish") && last(editor.calls, "news_publish").args.p_id === "d1",
        JSON.stringify(named(editor.calls, "news_publish").map(c => c.args)));

    click(editor, '[data-gf="refuse"]');
    await tick();
    check("turning one down carries a note back",
        !!last(editor.calls, "news_refuse") && last(editor.calls, "news_refuse").args.p_note === "Not this week",
        JSON.stringify(named(editor.calls, "news_refuse").map(c => c.args)));

    await click(editor, '[data-gf="publish"]');
    await tick();
    check("an empty story is not published", !last(editor.calls, "news_write"));

    type(editor, '[data-gf="headline"]', "The fleet sails");
    type(editor, '[data-gf="body"]', "The docks emptied before dawn.");
    click(editor, '[data-gf="publish"]');
    await tick();

    sent = last(editor.calls, "news_write");
    check("a story of the editor's own goes straight to the page", !!sent &&
        sent.args.p_headline === "The fleet sails" && !sent.args.p_id,
        JSON.stringify(sent && sent.args));

    click(editor, '[data-gf="lead"]');
    await tick();
    check("and the lead story is the editor's to set",
        !!last(editor.calls, "news_pin") && last(editor.calls, "news_pin").args.p_pinned === true,
        JSON.stringify(named(editor.calls, "news_pin").map(c => c.args)));

    click(editor, '[data-gf="rewrite"][data-id="d1"]');
    await tick();
    check("rewriting a dispatch brings its words to the desk",
        el(editor, '[data-gf="headline"]').value === "The line holds",
        el(editor, '[data-gf="headline"]').value);

    type(editor, '[data-gf="headline"]', "The line holds still");
    click(editor, '[data-gf="publish"]');
    await tick();
    check("and saves them back onto the same story",
        last(editor.calls, "news_write").args.p_id === "d1" &&
        last(editor.calls, "news_write").args.p_headline === "The line holds still",
        JSON.stringify(last(editor.calls, "news_write").args));

    console.log("\nthe picture desk");

    const picker = el(editor, '[data-gf="picture"]');
    Object.defineProperty(picker, "files", { value: [
        new editor.w.File(["x"], "front.png", { type: "image/png" })
    ], configurable: true });
    picker.dispatchEvent(new editor.w.Event("change", { bubbles: true }));
    await tick(); await tick();

    check("a picture is uploaded to the paper's own bucket",
        uploaded.length === 1 && uploaded[0].bucket === "news" && /^editor\//.test(uploaded[0].path) &&
        /\.png$/.test(uploaded[0].path), JSON.stringify(uploaded.map(u => u.path)));
    check("and comes back as a link everybody can see",
        /^https:\/\/cdn\.test\/news\/editor\//.test(el(editor, '[data-gf="image"]').value),
        el(editor, '[data-gf="image"]').value);

    const bare = page({ host: true, state: stateOf({ is_editor: true }) });
    await tick(); await tick();
    await open(bare);
    click(bare, '[data-gf="tab"][data-t="desk"]');
    await tick();

    const picker2 = el(bare, '[data-gf="picture"]');
    Object.defineProperty(picker2, "files", { value: [
        new bare.w.File(["x"], "front.png", { type: "image/png" })
    ], configurable: true });
    picker2.dispatchEvent(new bare.w.Event("change", { bubbles: true }));
    await tick();

    check("a project without storage says to paste a link instead",
        /put the picture online and paste its link/.test(panel(bare).textContent),
        panel(bare).textContent.slice(-260));

    console.log("\nthe chambers draw the same paper");

    const inline = page({ host: false, state: stateOf({}) });
    await tick(); await tick();

    const box = inline.w.document.createElement("div");
    inline.w.document.body.appendChild(box);
    inline.w.GFNews.render(box);

    check("a tab full of paper reads the same way", /THE GALACTIC FRONT/.test(box.textContent) &&
        /War opens on three fronts/.test(box.textContent), box.textContent.slice(0, 160));

    const congress = fs.readFileSync(path.join(ROOT, "congress.html"), "utf8");
    const combine = fs.readFileSync(path.join(ROOT, "combine.html"), "utf8");
    check("the Congress has the tab", /\["front", "THE FRONT PAGE"\]/.test(congress) &&
        /GFNews\.render/.test(congress));
    check("and so does the Supreme Soviet", /\["front", "THE FRONT PAGE"\]/.test(combine) &&
        /GFNews\.render/.test(combine));

    ["index.html", "galaxy.html", "planet.html", "battle.html", "congress.html", "combine.html", "space.html"]
        .forEach(function(p) {
            check("the paper is on " + p,
                fs.readFileSync(path.join(ROOT, p), "utf8").indexOf("news.js") !== -1);
        });

    console.log("\nand a database without the paper says so");

    const missing = page({ host: true, missing: true });
    await tick(); await tick();

    check("the host still gets a button", !!missing.w.document.getElementById("gf-news-button"));
    await open(missing);
    check("with the file to run in it",
        /2026-11-11_the_front_page\.sql/.test(panel(missing).textContent),
        panel(missing).textContent.slice(0, 200));

    console.log("\nand every word of it is in Portuguese");

    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/", runScripts: "dangerously"
    });
    dom.window.localStorage.setItem("gf_lang", "pt");
    dom.window.eval(I18N);
    const dict = dom.window.PT;

    const said = [];
    NEWS.replace(/\bT\(([^()]*)\)/g, function(all, arg) {
        (arg.match(/"[^"]*"/g) || []).forEach(function(s) { said.push(s.slice(1, -1)); });
        return all;
    });

    const untranslated = Array.from(new Set(said)).filter(s => s && !(s in dict));
    check("nothing the paper says is left in English", untranslated.length === 0, untranslated.join(" | "));
    check("the chamber's note is translated too",
        "The front page is the paper of the whole war: the host writes it, and the two faction leaders file dispatches that wait for the host to allow them." in dict);

}

(async function main() {

    try {
        await sqlHalf();
        await widgetHalf();
    }
    catch (e) {
        console.log("\nCRASH: " + String(e && e.message ? e.message : e).slice(0, 900));
        console.log("where: " + String(e && e.stack ? e.stack.split("\n")[1] : ""));
        process.exit(1);
    }

    console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " check(s) failed");
    process.exit(failures === 0 ? 0 : 1);

})();
