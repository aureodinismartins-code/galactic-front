/* jsdom checks for the language layer:
   - English players must not be shown Portuguese server text
   - Portuguese players must still get the Portuguese interface
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/lang-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let failures = 0;
function check(name, got, want) {
    if (String(got) === String(want)) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + "\n         got  " + JSON.stringify(got) + "\n         want " + JSON.stringify(want)); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

async function page(lang, html) {
    const dom = new JSDOM("<!doctype html><html><body>" + html + "</body></html>", {
        url: "https://example.test/congress.html",
        runScripts: "dangerously",
        pretendToBeVisual: true
    });
    dom.window.localStorage.setItem("gf_lang", lang);
    dom.window.eval(I18N);
    await wait(40);
    return dom;
}

async function main() {

    console.log("English player — server text arrives in Portuguese");

    const en = await page("en", `
        <h3 id="title">Autorizar a construção de uma nova frota</h3>
        <div id="effect">Uma nova frota foi autorizada: construa-a no mapa galáctico.</div>
        <div id="desc">Tradicional e militarista, com uma abordagem conservadora da expansão e do governo</div>
        <div id="log1">APROVADA: "Autorizar a construção de uma nova frota" (152 sim, 20 não, 4 abstenções; 118 necessários). Uma nova frota foi autorizada: construa-a no mapa galáctico.</div>
        <div id="log2">PROPOSTA: The Greens propõe "Ajuda econômica de emergência".</div>
        <div id="log3">PROPAGANDA: a campanha pela The Greens custou 5000 créditos e subiu a lealdade dos seus delegados em 13 pontos; 2 delegado(s) passaram-se para ela: Namor (Independents).</div>
        <div id="log4">O Congresso se reúne: 176 delegados de 88 áreas em 10 regiões.</div>
        <div id="war">Declaração de Guerra contra Veyrona</div>`);

    const t = id => en.window.document.getElementById(id).textContent;
    check("proposal title", t("title"), "Authorize New Fleet Construction");
    check("proposal effect", t("effect"), "A new fleet is authorised: build it from the galaxy map.");
    check("faction description", t("desc"),
        "Traditional and militaristic, with a conservative approach to expansion and government");
    check("PASSED log line (title and effect inside it)", t("log1"),
        'PASSED: "Authorize New Fleet Construction" (152 yes, 20 no, 4 abstain; 118 needed). ' +
        "A new fleet is authorised: build it from the galaxy map.");
    check("PROPOSAL log line", t("log2"), 'PROPOSAL: The Greens propose "Emergency Economic Relief".');
    check("propaganda log line", t("log3"),
        "PROPAGANDA: the campaign for The Greens cost 5000 credits and lifted the loyalty of its delegates " +
        "by 13 points; 2 delegate(s) crossed over to it: Namor (Independents).");
    check("congress convenes", t("log4"), "Congress convenes: 176 delegates from 88 areas in 10 regions.");
    check("war title", t("war"), "Declaration of War on Veyrona");

    /* text the server adds later is picked up too */
    const late = en.window.document.createElement("div");
    late.id = "late";
    late.textContent = "Proposta de aumento de impostos";
    en.window.document.body.appendChild(late);
    await wait(60);
    check("server text added after load", t("late"), "Taxation Increase Proposal");

    /* English interface text must be left alone */
    const plain = en.window.document.createElement("div");
    plain.id = "plain";
    plain.textContent = "SELECT TO BRIBE DELEGATES";
    en.window.document.body.appendChild(plain);
    await wait(60);
    check("English interface untouched", t("plain"), "SELECT TO BRIBE DELEGATES");

    console.log("Portuguese player — interface and server text in Portuguese");

    const pt = await page("pt", `
        <div id="ui">GALACTIC MAP</div>
        <div id="en">Authorize New Fleet Construction</div>
        <div id="server">Autorizar a construção de uma nova frota</div>`);
    const p = id => pt.window.document.getElementById(id).textContent;
    check("interface translated", p("ui"), "MAPA GALÁCTICO");
    check("English source translated", p("en"), "Autorizar a construção de uma nova frota");
    check("Portuguese server text is left as it is", p("server"), "Autorizar a construção de uma nova frota");

    console.log("the reverse dictionary covers what the server writes");
    const sql = fs.readFileSync(path.join(ROOT, "sql/2026-10-25_portuguese_server_text.sql"), "utf8");
    const stored = (sql.match(/return '([^']{3,})'/g) || [])
        .map(m => m.slice(8, -1))
        .filter(s => s.indexOf("%s") === -1 && s.indexOf("\\1") === -1);

    const probe = await page("en", "<div></div>");
    const missing = [];
    for (const s of stored) {
        if (!s || /[0-9]{2} [a-z]/.test(s)) { continue; }
        if (probe.window.t(s) === s) { missing.push(s); }
    }
    check("every stored sentence has an English counterpart", missing.length, 0);
    if (missing.length) { console.log("         missing: " + JSON.stringify(missing.slice(0, 8), null, 1)); }

    console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
    process.exit(failures ? 1 : 0);
}

main().catch(e => { console.log("FAIL harness: " + e.stack); process.exit(1); });
