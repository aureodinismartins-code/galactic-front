/* The airwaves on the screen: three tabs, a roster and a send box.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/chat-ui-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const CHAT = fs.readFileSync(path.join(ROOT, "chat.js"), "utf8");
const GALAXY = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const tick = (ms) => new Promise(r => setTimeout(r, ms || 30));

(async function main() {

    try {

        const calls = [];
        const virtualConsole = new VirtualConsole();
        virtualConsole.on("jsdomError", function() {});

        const dom = new JSDOM("<!doctype html><html><body></body></html>", {
            url: "https://example.test/galaxy.html", runScripts: "dangerously", virtualConsole: virtualConsole
        });

        const w = dom.window;
        w.T = (text) => text;

        w.supabaseClient = {
            rpc: function(name, args) {
                calls.push({ name: name, args: args || {} });

                if (name === "chat_people") {
                    return Promise.resolve({ data: { people: [
                        { id: B, name: "Boris", faction: "Combine", online: true }
                    ] }, error: null });
                }

                if (name === "chat_fetch") {
                    const channel = args.p_channel;
                    const body = channel === "global" ? "<b>Good evening</b>"
                        : channel === "team" ? "The Party is watching"
                        : "Meet me at Vraks";
                    return Promise.resolve({ data: { me: A, now: new Date().toISOString(), messages: [
                        { id: 1, channel: channel, sender: B, name: "Boris", to: null, body: body, at: new Date().toISOString() }
                    ] }, error: null });
                }

                if (name === "chat_send") { return Promise.resolve({ data: { id: 9 }, error: null }); }

                return Promise.resolve({ data: null, error: null });
            }
        };

        w.eval(CHAT);
        await tick(60);

        console.log("\n== the button and the panel");

        const button = w.document.getElementById("gf-chat-button");
        ok("the airwaves have a button", !!button);

        const panel = w.document.getElementById("gf-chat-panel");
        ok("and a panel to open", !!panel);
        ok("closed until asked", panel.style.display === "none");

        button.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick(80);

        ok("clicking opens it", panel.style.display === "block");
        ok("the three channels are on it",
            ["global", "team", "private"].every(t => !!panel.querySelector('[data-gf="chat-tab"][data-tab="' + t + '"]')));
        ok("global is the one it opens on",
            !!panel.querySelector('[data-gf="chat-tab"][data-tab="global"]') &&
            /7dffb0/.test(panel.querySelector('[data-gf="chat-tab"][data-tab="global"]').getAttribute("style") || ""));
        ok("the channel was fetched", calls.some(c => c.name === "chat_fetch" && c.args.p_channel === "global"),
            calls.filter(c => c.name === "chat_fetch").map(c => c.args));

        const list = panel.querySelector('[data-gf="chat-list"]');
        ok("what was said is drawn", /Good evening/.test(list.textContent), list.textContent);
        ok("and markup in a message is not run", /&lt;b&gt;/.test(list.innerHTML) && !/<b>Good/.test(list.innerHTML));

        console.log("\n== sending");

        const input = panel.querySelector('[data-gf="chat-input"]');
        input.value = "  hello, galaxy  ";
        panel.querySelector('[data-gf="chat-send"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick(80);

        const sent = calls.filter(c => c.name === "chat_send");
        ok("the message goes to the channel on screen", sent.length === 1 && sent[0].args.p_channel === "global", sent);
        ok("trimmed", sent.length === 1 && sent[0].args.p_body === "hello, galaxy", sent[0] && sent[0].args.p_body);
        ok("and the box is emptied", input.value === "", input.value);

        const before = calls.length;
        input.value = "";
        panel.querySelector('[data-gf="chat-send"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick(60);
        ok("an empty message is not sent", calls.slice(before).every(c => c.name !== "chat_send"),
            calls.slice(before).map(c => c.name));

        console.log("\n== the other channels");

        panel.querySelector('[data-gf="chat-tab"][data-tab="team"]')
            .dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick(80);

        ok("the team tab asks for the team channel",
            calls.some(c => c.name === "chat_fetch" && c.args.p_channel === "team"),
            calls.slice(-3).map(c => c.args));
        ok("and shows what the side said", /Party is watching/.test(panel.querySelector('[data-gf="chat-list"]').textContent));

        panel.querySelector('[data-gf="chat-tab"][data-tab="private"]')
            .dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick(80);

        const select = panel.querySelector('[data-gf="chat-who"]');
        ok("the private tab lists the commanders", !!select && /Boris/.test(select.textContent),
            select && select.textContent);
        ok("with who is online", !!select && /online/.test(select.textContent));

        const lastPrivate = calls.filter(c => c.name === "chat_fetch" && c.args.p_channel === "private").pop();
        ok("and opens the thread with the first of them", !!lastPrivate && lastPrivate.args.p_with === B,
            lastPrivate && lastPrivate.args);

        /* changing channel redraws the panel, so the box is a new node */
        const box = panel.querySelector('[data-gf="chat-input"]');
        box.value = "Vraks it is";
        panel.querySelector('[data-gf="chat-send"]').dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        await tick(80);

        const whisper = calls.filter(c => c.name === "chat_send").pop();
        ok("a whisper carries the commander it is meant for",
            whisper.args.p_channel === "private" && whisper.args.p_to === B, whisper.args);

        console.log("\n== the pages carry it");

        ok("every screen loads the airwaves", /<script src="chat.js\?v=1"><\/script>/.test(GALAXY));

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
