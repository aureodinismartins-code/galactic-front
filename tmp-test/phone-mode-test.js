/* Phone mode is one switch over seven pages, and most of what it does is
   CSS, which no source-level test can see. These guards cover the parts
   that would silently stop working: the pages that load the switch, the
   viewport that makes a phone honest about its width, the three paths
   that only exist on a phone (worlds, tap-to-send, touch orders), and the
   labels that must be in both languages.

   Run: node tmp-test/phone-mode-test.js */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
    if (ok) { passed++; console.log("  ok   " + name); }
    else { failed++; console.log("  FAIL " + name + (detail !== undefined ? "  :: " + detail : "")); }
}

function read(file) {
    return fs.readFileSync(path.join(ROOT, file), "utf8");
}

const mobile = read("mobile.js");
const i18n = read("i18n.js");

/* ---------------------------------------------------------
   every page carries the switch and a phone-honest viewport
--------------------------------------------------------- */

const pages = fs.readdirSync(ROOT).filter(function (f) { return f.endsWith(".html"); });

check("there are pages to check", pages.length >= 6, pages.length);

for (const page of pages) {

    const html = read(page);
    check(page + " loads phone mode",
        /mobile\.js\?v=4/.test(html), (html.match(/mobile\.js[^"]*/) || [])[0]);

    check(page + " declares the cut-out screen",
        /name="viewport"[\s\S]{0,120}viewport-fit=cover/.test(html));

}

/* ---------------------------------------------------------
   the switch itself
--------------------------------------------------------- */

check("the choice is remembered", /localStorage\.setItem\(KEY/.test(mobile) && /getItem\(KEY/.test(mobile));
check("a narrow window or a finger starts in it",
    /pointer: coarse/.test(mobile) && /innerWidth <= 900/.test(mobile));
check("a URL can force it either way", /get\("phone"\)/.test(mobile));
check("the switch is a button, not a keyboard shortcut", /gf-phone-button/.test(mobile));
check("other pages can read the switch", /window\.GF_PHONE/.test(mobile));

/* ---------------------------------------------------------
   the layouts that used to break
--------------------------------------------------------- */

check("the chamber pages become one column", /html\.gf-phone #main[\s\S]{0,80}grid-template-columns: 1fr/.test(mobile));
check("the tab strip scrolls sideways instead of stacking", /html\.gf-phone \.tabs[\s\S]{0,80}flex-wrap: nowrap/.test(mobile));
check("the fleet panel is a fixed sheet",
    /html\.gf-phone #fleet-command-panel[\s\S]{0,80}position: fixed/.test(mobile));
check("the planet page is sized in dvh", /100dvh/.test(mobile));
check("the planet's city dots are thumb-sized", /html\.gf-phone \.city-marker[\s\S]{0,60}width: 20px/.test(mobile));
check("the battle canvas does not scroll the page", /#battleCanvas \{ touch-action: none/.test(mobile));
check("the space canvas does too", /#c \{ touch-action: none/.test(mobile));
check("music and news sit clear of the dock", /#gf-music-button[\s\S]{0,120}bottom: calc\(env/.test(mobile));

/* ---------------------------------------------------------
   the galaxy: dots are not a map
--------------------------------------------------------- */

check("there is a world list", /id="gf-worlds-card"/.test(mobile) && /WORLDS/.test(mobile));
check("a world is opened by its name", /data-world/.test(mobile) && /planet\.click\(\)/.test(mobile));
check("the list says which worlds are yours", /classList\.contains\("freedom"\)|dataset\.owner/.test(mobile));
check("a fleet is sent without a right button",
    /new MouseEvent\("contextmenu"/.test(mobile));
check("and the tap is captured before the planet opens", /stopPropagation\(\)/.test(mobile));

check("the map can be pinched", /touchstart/.test(mobile) && /zoomAt\(/.test(mobile));
check("names appear once it is close enough", /gf-map-zoomed/.test(mobile));
check("a pan does not open a world", /suppress/.test(mobile));

/* ---------------------------------------------------------
   the battles
--------------------------------------------------------- */

const space = read("space.html");

check("space battle has touch input", /addEventListener\("touchstart"/.test(space) && /addEventListener\("touchmove"/.test(space));
check("a long press is the right-click order", /550\)/.test(space) && /fireMouse\("mousedown", touchTap\.x, touchTap\.y, 2\)/.test(space));
check("two fingers pan and pinch", /cam\.z = clamp\(cam\.z \* \(dist \/ touchPinch\.dist\)/.test(space));
check("the orders that were keys have buttons",
    /id="touch-orders"/.test(space) &&
    /data-act="brace"/.test(space) &&
    /data-act="centre"/.test(space) &&
    /command\("power"/.test(space));
check("touch orders are only shown in phone mode", /html\.gf-phone #touch-orders \{ display: flex/.test(space));
check("the canvas help says how to use a phone", /LONG-PRESS to move or attack/.test(space));

const battle = read("battle.html");

check("city battle has touch input", /canvas\.addEventListener\("touchstart"/.test(battle) && /canvas\.addEventListener\("touchmove"/.test(battle));
check("a long press orders a move there too", /orderAt\(touchStart\.x, touchStart\.y\)/.test(battle));
check("the touch box-select does not leave a drag running",
    /touchStart\.ordered = true;[\s\S]{0,80}isDraggingSelection = false;/.test(battle));
check("the order is the same right-click handler, not a second copy",
    /function orderAt\(x, y\) \{[\s\S]{0,260}new MouseEvent\("contextmenu"/.test(battle));

/* ---------------------------------------------------------
   and every new word is in Portuguese
--------------------------------------------------------- */

const used = new Set();

for (const m of mobile.matchAll(/T\("([^"]+)"\)/g)) { used.add(m[1]); }

check("the phone mode asks for translated words", used.size >= 8, used.size);

for (const key of used) {
    check("translated: " + key,
        i18n.indexOf('"' + key + '":') !== -1);
}


/* ---------------------------------------------------------
   the galaxy, after the first pass still did not work on a phone
--------------------------------------------------------- */

check("a minimised sheet still counts as a selected fleet",
    /function fleetSelected\(\)/.test(mobile) && /send\.disabled = !shown/.test(mobile));
check("aiming gets the fleet sheet off the worlds",
    /html\.gf-aim #fleet-command-panel/.test(mobile));
check("the map leaves the dock its strip",
    /html\.gf-phone \.galaxy-map \{ height: calc\(100% - 54px\); \}/.test(mobile));
check("a planet hit box is not wider than the gap to its neighbour",
    mobile.indexOf(".planet::after") === -1 &&
    /html\.gf-phone \.planet \{[\s\S]{0,90}width: 26px;/.test(mobile));
check("the zoom pad exists and the camera answers it",
    /id = "gf-zoom"/.test(mobile) && /window\.GF_PHONE\.zoom/.test(mobile));
check("the world list sends rather than travels while aiming",
    /if \(aiming\) \{[\s\S]{0,400}contextmenu/.test(mobile));
check("the new labels are translated",
    ["ZOOM IN", "ZOOM OUT", "FIT THE MAP", "SEND THE FLEET TO A WORLD"]
        .every(k => i18n.indexOf('"' + k + '"') !== -1));


/* ---------------------------------------------------------
   a desk choice must not follow the player onto a phone
--------------------------------------------------------- */

check("a choice made at a monitor is not honoured on a phone",
    /gf_phone_device/.test(mobile) && /made !== device/.test(mobile) &&
    /coarse \? "touch" : "desk"/.test(mobile));
check("every save records the kind of screen it was made on",
    /localStorage\.setItem\(DEVICE_KEY, device\)/.test(mobile));


check("a refusal from the page is shown, not swallowed by the hidden sheet",
    /function reportFleetMessage/.test(mobile) &&
    (mobile.split("reportFleetMessage()").length - 1) >= 2);
check("a send keeps the zoom the player set",
    /Date\.now\(\) - sentTap < 600/.test(mobile));

console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) { process.exit(1); }
