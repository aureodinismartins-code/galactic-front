/* The host brings a track in by its link, and a pasted file name is made
   absolute and given a readable title.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/music-add-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const MUSIC = fs.readFileSync(path.join(ROOT, "music.js"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));

async function open(host) {

    const calls = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("jsdomError", function() {});

    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/galaxy.html", runScripts: "dangerously", virtualConsole: virtualConsole
    });

    const w = dom.window;
    w.T = (text) => text;
    w.gameStatus = { is_host: host };

    let state = { is_host: host, tracks: [], playback: null, now: new Date().toISOString() };

    w.supabaseClient = {
        rpc: function(name, args) {
            calls.push({ name: name, args: args || {} });
            return Promise.resolve({ data: state, error: null });
        }
    };

    w.eval(MUSIC);
    await tick(80);

    const button = w.document.getElementById("gf-music-button");
    if (button) { button.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await tick(60); }

    return { w, calls, panel: w.document.getElementById("gf-music-panel") };

}

(async function main() {

    try {

        console.log("\n== the host");

        const host = await open(true);
        const panel = host.panel;

        ok("the wireless has a panel", !!panel);

        const input = panel.querySelector('[data-gf="link"]');
        ok("the host gets a box to paste a link into", !!input);

        input.value = "assets/music/pop/barry-manilow-copacabana-at-the-copa.mp3";

        panel.querySelector('[data-gf="add"]').dispatchEvent(new host.w.MouseEvent("click", { bubbles: true }));
        await tick(80);

        const added = host.calls.filter(c => c.name === "music_add");
        ok("sending it puts the track on", added.length === 1, added.map(c => c.name));

        if (added.length) {

            ok("the file name is made into a full address",
                added[0].args.p_url === "https://example.test/assets/music/pop/barry-manilow-copacabana-at-the-copa.mp3",
                added[0].args.p_url);

            ok("and read as a title rather than a file name",
                added[0].args.p_title === "barry manilow copacabana at the copa",
                added[0].args.p_title);

        }

        ok("the box is emptied again", input.value === "", input.value);

        console.log("\n== everybody else");

        const other = await open(false);
        ok("a player who is not the host gets no such box",
            !other.panel || !other.panel.querySelector('[data-gf="link"]'));

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

}());
