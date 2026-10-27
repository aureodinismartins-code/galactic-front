/* The ship's wireless: the host alone chooses the music, everybody hears the
   same track at the same second, and everybody has one control of their own
   — the mute.

   Two halves:

     - the SQL, against real PostgreSQL (PGlite): who may add and who may not,
       what the needle does, how a track moves on at the end, and what pausing
       means;
     - the widget, in jsdom: the host's controls, the crew's mute, and a
       browser following what the server says.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/wireless-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const PATCH = "sql/2026-11-08_shared_music_playlist.sql";
const MUSIC = fs.readFileSync(path.join(ROOT, "music.js"), "utf8");

const HOST = "11111111-1111-1111-1111-111111111111";   /* the account with the keys */
const GUEST = "22222222-2222-2222-2222-222222222222";  /* anybody else */
const NOBODY = "33333333-3333-3333-3333-333333333333";

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
insert into public.game_control (id, host_player) values (1, '${HOST}');

create table public.players (id uuid primary key, faction text, username text);
insert into public.players values
    ('${HOST}', 'Freedom Authority', 'President Hale'),
    ('${GUEST}', 'Combine', 'Comrade Volkov'),
    ('${NOBODY}', null, 'Nobody');
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

    console.log("the wireless in the database");

    const db = new PGlite();
    await db.exec(SCHEMA);
    await db.exec(fs.readFileSync(path.join(ROOT, PATCH), "utf8"));

    const made = (await call(db, "select (select count(*) from information_schema.tables " +
        "where table_schema = 'public' and table_name in ('music_tracks', 'music_playback'))::int as tables, " +
        "(select count(*) from information_schema.routines where routine_schema = 'public' and routine_name in " +
        "('music_is_host', 'music_state', 'music_add', 'music_remove', 'music_play', 'music_paused', " +
        "'music_advance'))::int as functions"))[0];
    check("the two tables are there", Number(made.tables) === 2, made.tables);
    check("and the seven functions", Number(made.functions) === 7, made.functions);

    console.log("\nthe host puts the first track on, and the wireless starts by itself");
    await as(db, HOST);
    let state = (await call(db, "select public.music_add('https://example.test/one.mp3', 'One') as s"))[0].s;
    check("the track is on the list", state.tracks.length === 1 && state.tracks[0].title === "One",
        JSON.stringify(state.tracks));
    check("the host is told the wireless is theirs", state.is_host === true, state.is_host);
    check("and it starts playing on it", state.playback && state.playback.paused === false &&
        state.playback.url === "https://example.test/one.mp3", JSON.stringify(state.playback));
    check("with the server's own clock, so the others can measure theirs",
        !!state.now && !!state.playback.started_at, state.now + " / " + state.playback.started_at);

    console.log("\nanybody may listen; nobody else may choose");
    await as(db, GUEST);
    state = (await call(db, "select public.music_state() as s"))[0].s;
    check("a guest hears the same track", state.tracks.length === 1 && state.playback.title === "One",
        JSON.stringify(state.playback));
    check("and is told it is not their wireless", state.is_host === false, state.is_host);

    let err = await expectError(db, "select public.music_add('https://example.test/two.mp3', 'Two')");
    check("a guest cannot add a track", /Only the host/.test(String(err)), err);
    err = await expectError(db, "select public.music_remove('" + state.tracks[0].id + "')");
    check("nor take one off", /Only the host/.test(String(err)), err);
    err = await expectError(db, "select public.music_play('" + state.tracks[0].id + "')");
    check("nor take the needle", /Only the host/.test(String(err)), err);
    err = await expectError(db, "select public.music_paused(true)");
    check("nor stop the music for everybody", /Only the host/.test(String(err)), err);

    console.log("\nwhat may be a track");
    await as(db, HOST);
    state = (await call(db, "select public.music_add('https://example.test/Two.mp3') as s"))[0].s;
    check("the title comes off the link when none is given",
        state.tracks.length === 2 && state.tracks[1].title === "Two",
        JSON.stringify(state.tracks.map(t => t.title)));

    err = await expectError(db, "select public.music_add('https://example.test/Two.mp3')");
    check("the same link twice is refused", /already on the wireless/.test(String(err)), err);
    err = await expectError(db, "select public.music_add('ftp://example.test/three.mp3')");
    check("a track has to be an http(s) link", /http\(s\) link/.test(String(err)), err);
    err = await expectError(db, "select public.music_add('')");
    check("an empty link is refused", /Paste a link/.test(String(err)), err);
    err = await expectError(db, "select public.music_add('https://example.test/' || repeat('x', 2100))");
    check("and so is a link nobody could have typed", /too long/.test(String(err)), err);

    const first = state.tracks[0].id;
    const second = state.tracks[1].id;

    console.log("\nthe needle only ever moves on");
    let adv = (await call(db, "select public.music_advance('" + first + "') as s"))[0].s;
    check("a track cannot be skipped in its first twenty seconds", adv.playback.id === first,
        JSON.stringify(adv.playback));

    await db.exec("update public.music_playback set started_at = now() - interval '2 minutes'");
    adv = (await call(db, "select public.music_advance('" + first + "') as s"))[0].s;
    check("twenty seconds on, the next track is on", adv.playback.id === second && adv.playback.paused === false,
        JSON.stringify(adv.playback));

    await as(db, GUEST);
    await db.exec("update public.music_playback set started_at = now() - interval '2 minutes'");
    adv = (await call(db, "select public.music_advance('" + second + "') as s"))[0].s;
    check("any player may move it on when a track ends", adv.playback.id === first, JSON.stringify(adv.playback));

    adv = (await call(db, "select public.music_advance('" + second + "') as s"))[0].s;
    check("but a track that is not the one playing cannot", adv.playback.id === first, JSON.stringify(adv.playback));

    console.log("\ntaking a track off");
    await as(db, HOST);
    state = (await call(db, "select public.music_remove('" + first + "') as s"))[0].s;
    check("the list loses it", state.tracks.length === 1 && state.tracks[0].id === second,
        JSON.stringify(state.tracks.map(t => t.title)));
    check("and the needle moves to what is left", state.playback && state.playback.id === second,
        JSON.stringify(state.playback));

    err = await expectError(db, "select public.music_remove('" + first + "')");
    check("taking off what is not there is refused", /not on the wireless/.test(String(err)), err);

    console.log("\npausing stops the whole galaxy");
    state = (await call(db, "select public.music_paused(true) as s"))[0].s;
    check("every screen is told the music is paused", state.playback.paused === true, JSON.stringify(state.playback));

    await db.exec("update public.music_playback set started_at = now() - interval '5 minutes'");
    const started = Date.now();
    state = (await call(db, "select public.music_paused(false) as s"))[0].s;
    check("and coming back starts the track from the top",
        state.playback.paused === false &&
        Math.abs(new Date(state.playback.started_at).getTime() - started) < 5000,
        state.playback.started_at);

    console.log("\nand a screen that is not signed in hears nothing");
    await db.exec("select set_config('test.me', '', false)");
    err = await expectError(db, "select public.music_state()");
    check("the state is refused", /Not authenticated/.test(String(err)), err);
    err = await expectError(db, "select public.music_add('https://example.test/four.mp3')");
    check("and so is adding", /Not authenticated/.test(String(err)), err);

}

/* ------------------------------------------------------------------
   the widget
   ------------------------------------------------------------------ */

const audios = [];

class FakeAudio {
    constructor() {
        this.src = "";
        this.paused = true;
        this.muted = false;
        this.volume = 1;
        this.currentTime = 0;
        this.duration = 100;
        this.dataset = {};
        this.listeners = {};
        this.plays = 0;
        audios.push(this);
    }
    addEventListener(name, fn) { (this.listeners[name] = this.listeners[name] || []).push(fn); }
    fire(name) { (this.listeners[name] || []).slice().forEach(fn => fn()); }
    play() {
        this.paused = false;
        this.plays++;
        this.fire("loadedmetadata");
        return Promise.resolve();
    }
    pause() { this.paused = true; }
}

function page(host, state) {

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

    w.gameStatus = { is_host: !!host };
    w.Audio = FakeAudio;
    w.supabaseClient = {
        rpc: function(name, args) {
            calls.push({ name: name, args: args || {} });
            const answer = (typeof state === "function") ? state(name, args || {}) : state;
            return Promise.resolve({ data: answer || null, error: null });
        }
    };

    w.eval(MUSIC);

    return { w: w, calls: calls };
}

const tick = () => new Promise(r => setTimeout(r, 30));
const named = (calls, name) => calls.filter(c => c.name === name);
const last = (calls, name) => {
    const all = named(calls, name);
    return all[all.length - 1];
};

async function widgetHalf() {

    console.log("\n\nthe wireless on the page");

    const track = { id: "t1", title: "One", url: "https://example.test/one.mp3" };
    const playing = { id: "t1", title: "One", url: track.url,
        started_at: iso(-30000), paused: false };

    console.log("the crew's wireless: the music, and one control");

    const guest = page(false, { now: iso(), is_host: false, tracks: [track], playback: playing });
    await tick();

    const guestButton = guest.w.document.getElementById("gf-music-button");
    check("a guest gets the wireless while there is music", !!guestButton);

    guestButton.dispatchEvent(new guest.w.MouseEvent("click", { bubbles: true }));
    await tick();

    const guestPanel = guest.w.document.getElementById("gf-music-panel");
    const mute = guestPanel.querySelector('[data-gf="mute"]');

    check("the panel is the crew's: a mute, no way to add",
        !!mute && !guestPanel.querySelector('[data-gf="url"]') &&
        ![...guestPanel.querySelectorAll("button")].some(b => /ADD BY LINK/.test(b.textContent)),
        guestPanel.textContent.slice(0, 160));
    check("and it says who chooses", /host chooses the music/.test(guestPanel.textContent),
        guestPanel.textContent.slice(0, 200));
    check("it says what is playing", /Playing:/.test(guestPanel.textContent) && /One/.test(guestPanel.textContent),
        guestPanel.textContent.slice(0, 120));

    const heard = audios[audios.length - 1];
    check("the browser plays the host's track", heard && heard.src === track.url, heard && heard.src);
    check("and jumps to where the others are in it", heard && Math.abs(heard.currentTime - 30) < 3,
        heard && heard.currentTime);

    mute.dispatchEvent(new guest.w.MouseEvent("click", { bubbles: true }));
    await tick();

    check("muting silences this browser", heard.muted === true, heard.muted);
    check("the button offers the way back",
        /UNMUTE/.test(guestPanel.querySelector('[data-gf="mute"]').textContent),
        guestPanel.querySelector('[data-gf="mute"]').textContent);
    check("and the choice is kept in this browser",
        /"muted":true/.test(guest.w.localStorage.getItem("gf_music_mine") || ""),
        guest.w.localStorage.getItem("gf_music_mine"));

    console.log("\na silent wireless is nobody's business");

    const silence = page(false, { now: iso(), is_host: false, tracks: [], playback: null });
    await tick();
    check("no button for a crew with nothing to hear",
        !silence.w.document.getElementById("gf-music-button"));

    silence.w.GFMusic.refresh().then(function() {});
    await silence.w.GFMusic.refresh();
    await tick();

    console.log("\nthe host's wireless: the list, and the only controls that choose");

    let hostState = { now: iso(), is_host: true, tracks: [], playback: null };

    const host = page(true, function(name, args) {

        if (name === "music_add") {
            hostState = Object.assign({}, hostState, {
                tracks: hostState.tracks.concat([{ id: "t9", title: args.p_title || "nine", url: args.p_url }])
            });
        }

        if (name === "music_remove") {
            hostState = Object.assign({}, hostState, {
                tracks: hostState.tracks.filter(t => t.id !== args.p_id)
            });
        }

        if (name === "music_play") {
            const track9 = hostState.tracks.filter(t => String(t.id) === String(args.p_id))[0];
            hostState = Object.assign({}, hostState, {
                playback: { id: args.p_id, title: track9 ? track9.title : "", url: track9 ? track9.url : "",
                            started_at: iso(), paused: false }
            });
        }

        if (name === "music_paused") {
            hostState = Object.assign({}, hostState, {
                playback: Object.assign({}, hostState.playback, { paused: args.p_paused === true })
            });
        }

        return hostState;

    });

    await tick();

    const hostButton = host.w.document.getElementById("gf-music-button");
    check("the host has the wireless even before there is music", !!hostButton);

    hostButton.dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
    await tick();

    const hostPanel = () => host.w.document.getElementById("gf-music-panel");

    check("the host is offered the link box and the file picker",
        !!hostPanel().querySelector('[data-gf="url"]') && !!hostPanel().querySelector('[data-gf="file"]'),
        hostPanel().textContent.slice(0, 160));

    const box = hostPanel().querySelector('[data-gf="url"]');
    box.value = "https://example.test/three.mp3";
    [...hostPanel().querySelectorAll("button")].find(b => /ADD BY LINK/.test(b.textContent))
        .dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
    await tick();

    check("adding by link asks the server to put it on",
        !!last(host.calls, "music_add") &&
        last(host.calls, "music_add").args.p_url === "https://example.test/three.mp3",
        JSON.stringify(host.calls.filter(c => c.name === "music_add").map(c => c.args)));
    check("and the box is emptied for the next one", box.value === "", box.value);
    check("the track appears on the host's list", /three/.test(hostPanel().textContent),
        hostPanel().textContent.slice(0, 200));

    /* a file name is taken from the folder the game is served from. The
       panel is redrawn after every answer, so the box is found again. */
    hostPanel().querySelector('[data-gf="url"]').value = "four.mp3";
    [...hostPanel().querySelectorAll("button")].find(b => /ADD BY LINK/.test(b.textContent))
        .dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
    await tick();

    check("and a bare file name is resolved against the game's own folder",
        last(host.calls, "music_add").args.p_url === "https://example.test/four.mp3",
        last(host.calls, "music_add").args.p_url);

    /* now with music on the list, and the needle on it */
    hostState = Object.assign({}, hostState, {
        tracks: hostState.tracks.concat([track]),
        playback: { id: "t1", title: "One", url: track.url, started_at: iso(-5000), paused: true }
    });

    await host.w.GFMusic.refresh();
    await tick();

    check("the playing track is marked on the list", /One/.test(hostPanel().textContent),
        hostPanel().textContent.slice(0, 200));

    hostPanel().querySelector('[data-gf="play"][data-id="t1"]')
        .dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
    await tick();

    check("pressing a track takes the needle there and plays it",
        !!last(host.calls, "music_play") && last(host.calls, "music_play").args.p_id === "t1",
        JSON.stringify(named(host.calls, "music_play").map(c => c.args)));

    hostPanel().querySelector('[data-gf="toggle"]')
        .dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
    await tick();

    check("the transport stops the music for the whole galaxy",
        !!last(host.calls, "music_paused") && last(host.calls, "music_paused").args.p_paused === true,
        JSON.stringify(named(host.calls, "music_paused").map(c => c.args)));

    hostPanel().querySelector('[data-gf="toggle"]')
        .dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
    await tick();

    check("and starts it again from the top",
        last(host.calls, "music_paused").args.p_paused === false,
        JSON.stringify(named(host.calls, "music_paused").map(c => c.args)));

    [...hostPanel().querySelectorAll("button")].find(b => b.dataset.gf === "next")
        .dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
    await tick();

    check("and skip to the next track on the list", !!last(host.calls, "music_play"),
        JSON.stringify(named(host.calls, "music_play").map(c => c.args)));

    const before = named(host.calls, "music_remove").length;
    hostPanel().querySelector('[data-gf="remove"][data-id="t1"]')
        .dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
    await tick();

    check("taking a track off is the host's too",
        named(host.calls, "music_remove").length === before + 1 &&
        last(host.calls, "music_remove").args.p_id === "t1",
        JSON.stringify(named(host.calls, "music_remove").map(c => c.args)));

    console.log("\nand a database without the wireless says so");
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", function() {});
    const bare = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/galaxy.html", runScripts: "dangerously", virtualConsole: virtualConsole
    });
    bare.window.gameStatus = { is_host: true };
    bare.window.Audio = FakeAudio;
    bare.window.supabaseClient = {
        rpc: function() {
            return Promise.resolve({ data: null, error: { message:
                "Could not find the function public.music_state in the schema cache" } });
        }
    };
    bare.window.eval(MUSIC);
    await tick();

    const clue = bare.window.document.getElementById("gf-music-button");
    check("the host still gets a button", !!clue);
    clue.dispatchEvent(new bare.window.MouseEvent("click", { bubbles: true }));
    await tick();

    check("with the file to run in it",
        /2026-11-08_shared_music_playlist\.sql/.test(
            bare.window.document.getElementById("gf-music-panel").textContent),
        bare.window.document.getElementById("gf-music-panel").textContent.slice(0, 200));

}

(async function main() {

    try {
        await sqlHalf();
        await widgetHalf();
    }
    catch (e) {
        console.log("\nCRASH: " + String(e && e.message ? e.message : e).slice(0, 900));
        if (e && e.where) { console.log("where: " + e.where); }
        process.exit(1);
    }

    console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " check(s) failed");
    process.exit(failures === 0 ? 0 : 1);

})();
