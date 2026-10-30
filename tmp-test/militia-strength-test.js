/* The woods are as big as the band: a militia company is five hundred men, so
   a band that recruited fields more companies and the deserters are paid for
   out of the same men. rebelWoodsComposition() is cut out of battle.html and
   asked directly, and the battle page is checked to read the band from the
   server before it places a single militiaman.

   Run: NODE_PATH=/tmp/gfnode/node_modules node tmp-test/militia-strength-test.js */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGE = fs.readFileSync(path.join(ROOT, "battle.html"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function grab(name) {

    const start = PAGE.indexOf("function " + name + "(");

    if (start < 0) { return null; }

    let depth = 0;

    for (let i = PAGE.indexOf("{", start); i < PAGE.length; i++) {

        if (PAGE[i] === "{") { depth++; }
        else if (PAGE[i] === "}") {
            depth--;
            if (!depth) { return PAGE.slice(start, i + 1); }
        }

    }

    return null;

}

const base = /const rebelMilitiaBase = \{[^}]*\};/.exec(PAGE);
const body = grab("rebelWoodsComposition");

const composition = (base && body)
    ? new Function(base[0] + "\n" + body + "\nreturn rebelWoodsComposition;")()
    : null;

function menOf(comp) {
    return (Number(comp.Militia) || 0) * 500 + (Number(comp.Rifle) || 0) * 1000;
}

function unitsOf(comp) {
    return (Number(comp.Militia) || 0) + (Number(comp.Rifle) || 0);
}

/* ---------- the shape of it ---------- */

console.log("\n== the composition is in the page");

ok("the fixed camp is still the fallback", !!base, base && base[0]);
ok("and the composition is its own function", !!body);

if (!composition) {
    console.log("\n0 passed, " + (fail + 2) + " failed");
    process.exit(1);
}

console.log("\n== a band of one company per five hundred men");

const one = composition(1500);

ok("a band of 1,500 is three militia companies", one.Militia === 3, one);
ok("with no deserters yet", one.Rifle === 0, one);
ok("and the wood holds the band's own men", menOf(one) === 1500, menOf(one));

const two = composition(3000);

ok("two bands put six companies in the trees", two.Militia + two.Rifle * 2 === 6, two);
ok("and one of them is the deserters", two.Rifle === 1, two);
ok("still worth exactly the men who stand there", menOf(two) === 3000, menOf(two));

console.log("\n== and a band that has recruited is fatter");

const fat = composition(3500);

ok("500 recruits make a seventh company", fat.Militia + fat.Rifle * 2 === 7, fat);
ok("the wood now holds 3,500 men", menOf(fat) === 3500, menOf(fat));
ok("which is more men than the thin band fielded", menOf(fat) > menOf(one), [menOf(one), menOf(fat)]);
ok("and more units", unitsOf(fat) > unitsOf(one), [unitsOf(one), unitsOf(fat)]);

const big = composition(6000);

ok("four bands put twelve companies in the trees", big.Militia + big.Rifle * 2 === 12, big);
ok("with deserters among them", big.Rifle >= 1, big);
ok("again for exactly the men who stand there", menOf(big) === 6000, menOf(big));

console.log("\n== the trees hold only so many");

const horde = composition(40000);

ok("the companies stop at twenty-four", horde.Militia + horde.Rifle * 2 <= 24, horde);
ok("and fewer than twelve thousand men take the field", menOf(horde) <= 12000, menOf(horde));
ok("but somebody is always there to fight", unitsOf(horde) >= 1, horde);

console.log("\n== before the server answers");

const unknown = composition(0);

ok("the old fixed camp stands in the woods", unknown.Militia === 8 && unknown.Rifle === 3, unknown);

const nonsense = composition("not a number");

ok("and nonsense is treated as no answer", nonsense.Militia === 8 && nonsense.Rifle === 3, nonsense);

console.log("\n== the page reads the band before it places it");

const fleet = PAGE.slice(PAGE.indexOf("async function loadFleet()"), PAGE.indexOf("function createPlayerUnits("));

ok("the band is read from the server", /rpc\("unrest_state"\)/.test(PAGE) && /async function loadRebelBand\(/.test(PAGE));
ok("and read before the enemy is placed", /await loadRebelBand\(\);[\s\S]*createPlayerUnits\(divisions\);/.test(fleet),
    fleet.slice(0, 80));
ok("the woods take their size from it", /rebelWoodsComposition\(rebelBandMen\)/.test(PAGE));
ok("the fixed composition is gone", PAGE.indexOf("rebelMilitiaComposition") === -1);
ok("and the page says what stands there",
    /in the woods: " \+ Number\(rebelBandMen\)[\s\S]{0,120}?" band" : " bands"/.test(PAGE), PAGE.indexOf("The militia is in the woods: "));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
