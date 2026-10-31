/* The stations of the ship's wireless.

   music.js now reads assets/music/stations.json: five stations, one folder
   each, the files committed with the game. Every player picks their own
   station; the shared wireless stays the host's.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/radio-stations-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const MUSIC = fs.readFileSync(path.join(ROOT, "music.js"), "utf8");
const MANIFEST = fs.readFileSync(path.join(ROOT, "assets/music/stations.json"), "utf8");
const README = fs.readFileSync(path.join(ROOT, "assets/music/README.md"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const tick = () => new Promise(r => setTimeout(r, 25));

console.log("\n== the stations on the shelf");

let manifest = null;
try { manifest = JSON.parse(MANIFEST); } catch (e) { /* reported below */ }

ok("stations.json is there and is valid", !!manifest);
ok("there are six stations", manifest && Array.isArray(manifest.stations) && manifest.stations.length === 6);

const ids = (manifest && manifest.stations || []).map(s => s.id);
ok("jazz, classical, aura, commercials, GFNN and its Portuguese desk",
    ["jazz", "classical", "aura", "commercials", "gfnn", "gfnn-pt"].every(id => ids.indexOf(id) !== -1), ids);

ok("every station has a folder", (manifest && manifest.stations || []).every(s => !!s.folder));
ok("every station folder is in the repository",
    (manifest && manifest.stations || []).every(s => fs.existsSync(path.join(ROOT, "assets/music", s.folder))));
ok("the README explains how to put a file in", /stations\.json/.test(README) && /tracks/.test(README));

/* ---------------------------------------------------------
   the player
--------------------------------------------------------- */

let audios = [];

class FakeAudio {
    constructor() {
        this.src = ""; this.paused = true; this.muted = false; this.volume = 1;
        this.currentTime = 0; this.duration = NaN; this.handlers = {};
        audios.push(this);
    }
    addEventListener(kind, fn) { (this.handlers[kind] = this.handlers[kind] || []).push(fn); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    fire(kind) { (this.handlers[kind] || []).forEach(fn => fn({})); }
}

const STATIONS = JSON.stringify({
    stations: [
        { id: "jazz", label: "JAZZ", folder: "jazz", tracks: ["one.mp3", "two.mp3"] },
        { id: "classical", label: "CLASSICAL", folder: "classical", tracks: [] },
        { id: "gfnn", label: "GFNN", folder: "gfnn", tracks: ["bulletin.mp3"] }
    ]
});

async function player(withStations, hand) {

    audios = [];

    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", function() {});

    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/galaxy.html",
        runScripts: "dangerously",
        virtualConsole: virtualConsole
    });

    const w = dom.window;

    w.gameStatus = { is_host: false };
    w.Audio = FakeAudio;
    w.supabaseClient = { rpc: function() { return Promise.resolve({ data: { now: new Date().toISOString(), is_host: false, tracks: [], playback: null }, error: null }); } };

    w.fetch = function(url) {

        if (!withStations) { return Promise.resolve({ ok: false, json: function() { return Promise.resolve(null); } }); }

        if (hand) { return Promise.resolve({ ok: true, text: function() { return Promise.resolve(hand); } }); }

        return Promise.resolve({ ok: true, json: function() { return Promise.resolve(JSON.parse(STATIONS)); } });
    };

    w.eval(MUSIC);
    await tick();
    await tick();
    await tick();

    return w;
}

(async function main() {

    try {

        console.log("\n== a player picks a station");

        const w = await player(true);

        ok("the wireless reads the stations", w.GFMusic.stations().length === 3, w.GFMusic.stations().map(s => s.id));

        const button = w.document.getElementById("gf-music-button");
        ok("the crew gets the wireless because the stations are on the air", !!button);
        if (!button) { throw new Error("no wireless button"); }

        button.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick();

        const panel = w.document.getElementById("gf-music-panel");
        const jazz = panel.querySelector('[data-gf="station"][data-i="0"]');

        ok("the stations are in the panel", !!jazz && /JAZZ/.test(panel.textContent), panel.textContent.slice(0, 120));

        jazz.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick();

        let heard = audios[audios.length - 1];

        ok("picking one plays its first file",
            !!heard && heard.src === "https://example.test/assets/music/jazz/one.mp3", heard && heard.src);
        ok("and it is heard, not paused", !!heard && heard.paused === false);
        ok("the panel says which station and which track",
            /JAZZ/.test(panel.textContent) && /one/.test(panel.textContent), panel.textContent.slice(0, 200));

        heard.fire("ended");
        await tick();

        ok("the station moves on when a track ends", heard.src === "https://example.test/assets/music/jazz/two.mp3", heard.src);

        heard.fire("ended");
        await tick();

        ok("and loops back to the top", heard.src === "https://example.test/assets/music/jazz/one.mp3", heard.src);

        /* the shared wireless must not pull the needle back */
        await w.GFMusic.refresh();
        await tick();

        ok("the host's wireless does not take the station's place",
            heard.src === "https://example.test/assets/music/jazz/one.mp3" && heard.paused === false, heard.src);

        const next = panel.querySelector('[data-gf="next"]');

        ok("the crew gets the transport while a station plays", !!next);

        next.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick();

        ok("and may skip", heard.src === "https://example.test/assets/music/jazz/two.mp3", heard.src);

        /* a file that will not play is passed over */
        heard.fire("error");
        await tick();

        ok("a broken file is skipped", heard.src === "https://example.test/assets/music/jazz/one.mp3", heard.src);

        /* a station with nothing in it says so */
        const classical = panel.querySelector('[data-gf="station"][data-i="1"]');
        classical.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick();

        ok("an empty station says so",
            /nothing|no ar|empty/i.test(panel.textContent) && /CLASSICAL/.test(panel.textContent),
            panel.textContent.slice(0, 200));

        const gfnn = panel.querySelector('[data-gf="station"][data-i="2"]');
        gfnn.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick();

        ok("another station plays its own folder",
            heard.src === "https://example.test/assets/music/gfnn/bulletin.mp3", heard.src);

        /* muting silences the station too */
        muted: {
            const mute = panel.querySelector('[data-gf="mute"]');
            ok("the crew can mute a station", !!mute);
            if (mute) {
                mute.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
                await tick();
                ok("muting silences it", heard.muted === true, heard.muted);
            }
        }

        console.log("\n== a game with no stations file");

        const bare = await player(false);

        ok("no stations, no wireless for a crew with nothing to hear",
            !bare.document.getElementById("gf-music-button"));

        const host = bare.document.createElement("div");

        console.log("\n== a manifest written by hand");

        /* the file a player edits in the GitHub box, with the track name left
           without its quotes: not valid JSON, but the stations still play */
        const HAND = `{
    "stations": [
        {
            "id": "jazz",
            "label": "JAZZ",
            "folder": "jazz",
            "tracks": []
        },
        {
            "id": "classical",
            "label": "CLASSICAL",
            "folder": "classical",
            "tracks": []
        },
        {
            "id": "aura",
            "label": "AURA",
            "folder": "aura",
            "tracks": [Succession (Main Title Theme) - Nicholas Britell _ Succession (HBO Original Series Soundtrack).mp3]
        },
        {
            "id": "commercials",
            "label": "RADIO COMMERCIALS",
            "folder": "commercials",
            "tracks": []
        },
        {
            "id": "gfnn",
            "label": "GFNN",
            "folder": "gfnn",
            "tracks": []
        }
    ]
}`;

        const hw = await player(true, HAND);

        ok("the stations are read even though the file is not valid JSON",
            hw.GFMusic.stations().length === 5, hw.GFMusic.stations().length);

        const aura = hw.GFMusic.stations()[2];

        ok("the name written without quotes is still read",
            aura && aura.tracks.length === 1 && /^Succession/.test(aura.tracks[0]), aura && aura.tracks);

        hw.document.getElementById("gf-music-button")
            .dispatchEvent(new hw.MouseEvent("click", { bubbles: true }));
        await tick();

        hw.document.querySelector('[data-gf="station"][data-i="2"]')
            .dispatchEvent(new hw.MouseEvent("click", { bubbles: true }));
        await tick();

        const handAudio = audios[audios.length - 1];

        ok("and it plays from the aura folder, spaces and all",
            !!handAudio && handAudio.src ===
                "https://example.test/assets/music/aura/Succession%20(Main%20Title%20Theme)%20-%20Nicholas%20Britell%20_%20Succession%20(HBO%20Original%20Series%20Soundtrack).mp3",
            handAudio && handAudio.src);

        console.log("\n== the panel is left as it was");

        ok("the shared wireless is untouched by the stations",
            /music_state/.test(MUSIC) && /music_play/.test(MUSIC));
        ok("and there is nothing left to paste a link into",
            !/data-gf="url"/.test(MUSIC) && !/ADD BY LINK/.test(MUSIC) && !/PICK A FILE/.test(MUSIC));

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
