/* Does an occupied world's unrest bar say what is feeding it — the occupation,
   the relief, the policy, the missing fleet, the tax, and the trouble planted
   before the world was even taken — in both halls and in Portuguese?

   Run: NODE_PATH=/tmp/gfnode/node_modules node tmp-test/unrest-feeds-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let failures = 0;

function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + String(extra).slice(0, 240) + "]" : "")); }
}

function grab(src, name) {
    const i = src.indexOf("function " + name + "(");
    if (i < 0) { return ""; }
    const end = src.indexOf("\n}\n", i);
    return end < 0 ? src.slice(i) : src.slice(i, end + 3);
}

/* a const can be written on one line or over many: both end at the first };
 */
function grabConst(src, name) {
    const i = src.indexOf("const " + name + " = {");
    if (i < 0) { return ""; }
    const end = src.indexOf("};", i);
    return end < 0 ? "" : src.slice(i, end + 2);
}

function flat(html) {
    return String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const FIXTURE = {
    turn: 300,
    revolt_at: 100,
    worlds: [
        {
            planet: "Krieg", faction: "Combine", unrest: 62, mood: "RIOTING", revolts: 0, mine: true,
            policy: "reprisals", garrison: { fleets: 0, soldiers: 0 }, tax: 2, delta: 8,
            calm: { price: 600, ready_in: 0 }, fight: { ready_in: 0, rebels: true, garrison: true },
            feeds: [
                { key: "occupation", value: 4 },
                { key: "relief", value: -2 },
                { key: "policy", value: 2 },
                { key: "fleet", value: 2 },
                { key: "tax", value: 2 },
                { key: "planted", value: 20 }
            ]
        },
        {
            planet: "Ithaca", faction: "Combine", unrest: 18, mood: "CALM", revolts: 2, mine: true,
            policy: "amnesty", garrison: { fleets: 1, soldiers: 900 }, tax: 1, delta: 2,
            calm: { price: 600, ready_in: 120 }, fight: { ready_in: 0, rebels: false, garrison: false },
            feeds: [
                { key: "occupation", value: 4 },
                { key: "relief", value: -2 },
                { key: "policy", value: 0 },
                { key: "fleet", value: 0 },
                { key: "tax", value: 0 },
                { key: "planted", value: 0 }
            ]
        }
    ]
};

async function build(page, lang) {

    const HTML = fs.readFileSync(path.join(ROOT, page), "utf8");

    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://example.test/" + page,
        runScripts: "dangerously",
        pretendToBeVisual: true
    });

    const w = dom.window;
    w.localStorage.setItem("gf_lang", lang);
    w.eval(I18N);
    await new Promise(r => setTimeout(r, 40));   /* i18n starts on DOMContentLoaded */

    w.T = s => (typeof w.t === "function" ? w.t(s) : s);
    w.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

    const parts = [
        grabConst(HTML, "FEED_LABELS"),
        grabConst(HTML, "POLICY_LABELS"),
        grab(HTML, "unrestFor"),
        grab(HTML, "feedsLine"),
        grab(HTML, "rebelsLine"),
        grab(HTML, "unrestLine"),
        grab(HTML, "policyLine")
    ];

    check(page + ": the bar has a parts builder", /function feedsLine\(/.test(HTML));
    check(page + ": the bar calls it", /feedsLine\(u\)/.test(HTML));
    check(page + ": the terms have names", /const FEED_LABELS = \{/.test(HTML));

    w.eval(parts.join("\n"));
    w.unrest = FIXTURE;

    return w;

}

(async function main() {

    console.log("\n== the Authority's Congress");

    const cg = await build("congress.html", "en");
    const congress = flat(cg.unrestLine("Krieg"));

    check("the bar says what feeds it", congress.indexOf("WHAT FEEDS IT:") !== -1, congress);
    check("the occupation is named, and what it is worth",
        congress.indexOf("the occupation itself +4") !== -1, congress);
    check("relief is named, and it holds the bar down",
        congress.indexOf("stability bought with relief \u22122") !== -1, congress);
    check("the policy is named", congress.indexOf("the policy in force +2") !== -1, congress);
    check("a missing fleet is named", congress.indexOf("no fleet of ours in orbit +2") !== -1, congress);
    check("the tax is named", congress.indexOf("the tax +2") !== -1, congress);
    check("and the planted trouble is named as the one-off it is",
        congress.indexOf("planted trouble +20 (already in the bar)") !== -1, congress);
    check("the parts come before the sermon", congress.indexOf("WHAT FEEDS IT") < congress.indexOf("Unrest climbs on a world"),
        congress);

    const calm = flat(cg.unrestLine("Ithaca"));

    check("a world with nothing piling up names only what is there",
        calm.indexOf("the occupation itself +4") !== -1 &&
        calm.indexOf("the policy in force") === -1 &&
        calm.indexOf("no fleet of ours in orbit") === -1 &&
        calm.indexOf("the tax") === -1 &&
        calm.indexOf("planted trouble") === -1, calm);
    check("and a world with no bar says nothing at all", cg.unrestLine("Nowhere") === "");

    console.log("\n== the Combine's Soviet");

    const cs = await build("combine.html", "en");
    const soviet = flat(cs.unrestLine("Krieg"));

    check("the Soviet names the parts too",
        soviet.indexOf("WHAT FEEDS IT:") !== -1 &&
        soviet.indexOf("the occupation itself +4") !== -1 &&
        soviet.indexOf("the tax +2") !== -1, soviet);
    check("and its planted trouble", soviet.indexOf("planted trouble +20") !== -1, soviet);
    check("and it leaves out the calm terms", flat(cs.unrestLine("Ithaca")).indexOf("the policy in force") === -1);

    console.log("\n== the two answers under the bar");

    const rioting = cg.unrestLine("Krieg");
    const fightBtn = /<button class="btn small fight-rebels"[^>]*>/.exec(rioting);
    const calmBtn = /<button class="btn small calm-world"[^>]*>/.exec(rioting);

    check("the world can be calmed for money, and the price is on the button",
        rioting.indexOf("CALM THE WORLD (600)") !== -1, rioting.slice(0, 200));
    check("the money is on offer when nothing is on a cooldown", !!calmBtn && calmBtn[0].indexOf("disabled") === -1,
        calmBtn && calmBtn[0]);
    check("and the rebels can be fought while they are up and a fleet is there",
        !!fightBtn && fightBtn[0].indexOf("disabled") === -1 && rioting.indexOf("Send the troops in") !== -1,
        fightBtn && fightBtn[0]);

    const quiet = flat(cg.unrestLine("Ithaca"));
    const calmQuiet = /<button class="btn small calm-world"[^>]*>/.exec(cg.unrestLine("Ithaca"));
    const fightQuiet = /<button class="btn small fight-rebels"[^>]*>/.exec(cg.unrestLine("Ithaca"));

    check("a world whose ringleaders will not take money has the button dark",
        !!calmQuiet && calmQuiet[0].indexOf("disabled") !== -1, calmQuiet && calmQuiet[0]);
    check("and says how long they will wait", quiet.indexOf("take money again in 120 s") !== -1, quiet);
    check("with no rebels up, no fight is offered",
        !!fightQuiet && fightQuiet[0].indexOf("disabled") !== -1 &&
        quiet.indexOf("No rebels have risen here yet") !== -1, quiet);

    cg.unrest.worlds[0].fight.garrison = false;
    const noFleet = flat(cg.unrestLine("Krieg"));
    const noFleetBtn = /<button class="btn small fight-rebels"[^>]*>/.exec(cg.unrestLine("Krieg"));

    check("the rebels are up but there is nobody to send",
        !!noFleetBtn && noFleetBtn[0].indexOf("disabled") !== -1 &&
        noFleet.indexOf("no fleet of ours is in orbit to send") !== -1, noFleet);
    cg.unrest.worlds[0].fight.garrison = true;

    console.log("\n== in Portuguese");

    const pt = await build("congress.html", "pt");
    const traducao = flat(pt.unrestLine("Krieg"));

    check("the heading is translated", traducao.indexOf("O QUE A ALIMENTA") !== -1, traducao);
    check("the occupation is translated", traducao.indexOf("a própria ocupação +4") !== -1, traducao);
    check("the relief is translated", traducao.indexOf("estabilidade comprada com ajuda \u22122") !== -1, traducao);
    check("the tax is translated", traducao.indexOf("o imposto +2") !== -1, traducao);
    check("the planted trouble is translated",
        traducao.indexOf("problema plantado +20") !== -1 && traducao.indexOf("(já na barra)") !== -1, traducao);

    const ptcs = await build("combine.html", "pt");
    const traducaoSoviet = flat(ptcs.unrestLine("Krieg"));

    check("the Soviet speaks Portuguese too",
        traducaoSoviet.indexOf("O QUE A ALIMENTA") !== -1 &&
        traducaoSoviet.indexOf("a própria ocupação +4") !== -1, traducaoSoviet);

    console.log("");
    if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
    console.log("all checks passed");

})();
