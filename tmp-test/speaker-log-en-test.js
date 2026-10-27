/* The chamber's log reads back in English. Its chair is the Speaker of the
   Congress (2026-11-12), and the log still holds what was written before the
   rename, so the older wording has to be read too.
   Run: NODE_PATH=/tmp/h/node_modules node tmp-test/speaker-log-en-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://example.test/congress.html", runScripts: "dangerously", pretendToBeVisual: true });
const w = dom.window;
w.localStorage.setItem("gf_lang", "en");
w.eval(I18N);

function read(text) {
    const box = w.document.createElement("div");
    box.appendChild(w.document.createTextNode(text));
    w.document.body.appendChild(box);
    return new Promise(function (resolve) {
        setTimeout(function () { const out = box.textContent; box.remove(); resolve(out); }, 60);
    });
}

(async function main() {

    await new Promise(r => setTimeout(r, 40));

    const LOG = [
        ["CONGRESSO: a eleição para Orador do Congresso foi aberta. Declare a candidatura (8 minutos), depois todos votam (8 minutos).",
            "the election of the Speaker of the Congress is open", 1],
        ["CONGRESSO: ninguém se candidatou a Orador do Congresso. A campanha foi prorrogada por 5 minutos.",
            "nobody stood for Speaker of the Congress", 1],
        ["CONGRESSO: a votação para Orador do Congresso está aberta.",
            "the vote for Speaker of the Congress is open", 1],
        ["CONGRESSO: Bia Costa é eleito Orador do Congresso (3 voto(s)). Toma a cadeira e o veto da casa.",
            "Bia Costa is elected Speaker of the Congress (3 vote(s))", 1],
        ["CANDIDATURA: Bia Costa apresenta-se a Orador do Congresso.",
            "Bia Costa stands for Speaker of the Congress", 1],
        ["VETO: o Orador do Congresso Bia Costa veta \"Nova frota\".",
            "the Speaker of the Congress Bia Costa vetoes", 1],
        /* what the log already holds, written before the rename */
        ["CONGRESSO: a eleição para Presidente do Congresso foi aberta. Declare a candidatura (8 minutos), depois todos votam (8 minutos).",
            "the election of the Speaker of the Congress is open", 1],
        ["CONGRESSO: ninguém se candidatou à presidência do Congresso. A campanha foi prorrogada por 5 minutos.",
            "nobody stood for Speaker of the Congress", 1],
        ["CONGRESSO: a votação para Presidente do Congresso está aberta.",
            "the vote for Speaker of the Congress is open", 1],
        ["CONGRESSO: Rui Alves é eleito Presidente do Congresso (2 voto(s)). Toma a cadeira e o veto da casa.",
            "Rui Alves is elected Speaker of the Congress (2 vote(s))", 1],
        ["CANDIDATURA: Rui Alves apresenta-se a Presidente do Congresso.",
            "Rui Alves stands for Speaker of the Congress", 1],
        ["VETO: o Presidente do Congresso Rui Alves veta \"Nova frota\".",
            "the Speaker of the Congress Rui Alves vetoes", 1],
        /* the President of the Freedom Authority is not renamed */
        ["ELEIÇÃO: Ana Rocha é eleito Presidente da Freedom Authority (12 votos).",
            "Ana Rocha is elected President of the Freedom Authority (12 votos)", 0]
    ];

    console.log("the chamber's log, read back in English");
    for (const [pt, want, english] of LOG) {
        const got = await read(pt);
        check((english ? "Speaker: " : "the faction leader is left alone: ") + want.slice(0, 46),
            got.indexOf(want) !== -1 && (english ? !/[À-ÿ]/.test(got) : true), got);
    }

    console.log(failures ? "\n" + failures + " check(s) failed" : "\nall checks passed");
    process.exit(failures ? 1 : 0);

})();
