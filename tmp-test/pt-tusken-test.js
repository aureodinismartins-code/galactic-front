/* The Portuguese of Tuskara, the slave ledger and the server's new answers:
   a player who chose PT must read the desert in Portuguese, and a player who
   chose EN must not be shown Portuguese because of it.

   Run: NODE_PATH=/tmp/gfnode/node_modules node tmp-test/pt-tusken-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const I18N = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, got, want) {
    if (String(got) === String(want)) { pass++; console.log("  ok   " + name); }
    else {
        fail++;
        console.log("  FAIL " + name + "\n         got  " + JSON.stringify(got) + "\n         want " + JSON.stringify(want));
    }
}

const wait = ms => new Promise(r => setTimeout(r, ms || 40));

async function page(lang, html) {
    const dom = new JSDOM("<!doctype html><html><body>" + (html || "") + "</body></html>", {
        url: "https://example.test/planet.html",
        runScripts: "dangerously",
        pretendToBeVisual: true
    });
    dom.window.localStorage.setItem("gf_lang", lang);
    dom.window.eval(I18N);
    await wait();
    return dom;
}

async function main() {

    console.log("\n== a Portuguese player on Tuskara");

    const pt = await page("pt");
    const t = pt.window.t;

    ok("the board's title", t("THE TUSKEN HOMEWORLD · NOTHING IS CONQUERED HERE, ONLY SETTLED"),
        "O MUNDO NATAL DOS TUSKEN · AQUI NADA É CONQUISTADO, SÓ COLONIZADO");
    ok("the pens", t("IN THE PENS"), "NOS CERCOS");
    ok("the settlement", t("SETTLEMENT"), "ASSENTAMENTO");
    ok("the transports", t("THE FLEET THE NEXT HULL JOINS"), "A FROTA QUE O PRÓXIMO CASCO INTEGRA");
    ok("the load", t("SEND THE LOAD"), "ENVIAR A CARGA");
    ok("the convoys", t("ON THE ROAD"), "NA ESTRADA");
    ok("a scouted rival", t("UNKNOWN SETTLEMENT"), "ASSENTAMENTO DESCONHECIDO");
    ok("the spy button", t("SEND A SPY — 250 CR"), "ENVIAR UM ESPIÃO — 250 CR");
    ok("the waiting bands", t("THE BANDS REST — 4m 10s"), "OS BANDOS DESCANSAM — 4m 10s");
    ok("the fonder", t("FORM A FLEET — 300 CR"), "FORME UMA FROTA — 300 CR");
    ok("the buyer", t("BUY A TRANSPORT — 350 CR"), "COMPRAR UM TRANSPORTE — 350 CR");
    ok("a settlement's numbers", t("3 OF 4 SETTLED"), "3 DE 4 COLONIZADOS");
    ok("a fleet's hulls", t("4 HULLS · 10,000 LIFT"), "4 CASCOS · 10,000 CAPACIDADE");
    ok("the hulls in port", t("2 IN PORT · 350 A HULL"), "2 NO PORTO · 350 POR CASCO");
    ok("the work is paid", t("+3 / PAYMENT"), "+3 / PAGAMENTO");
    ok("a hull at sea", t("AT SEA → Krieg"), "NO MAR → Krieg");
    ok("the load's ceiling",
        t("Up to 2,500 on the Coffin Ships · 2,500 lift · the trip is free"),
        "Até 2,500 no Coffin Ships · 2,500 de capacidade · a viagem é grátis");
    ok("the bands capture", t("takes up to 400 an hour"), "captura até 400 por hora");
    ok("an empty road", t("No ships on the road."), "Nenhum navio na estrada.");
    ok("nothing to load", t("Nothing to load here."), "Não há nada para carregar aqui.");

    console.log("\n== the ledger tab on the planet page");

    ok("the tab", t("SLAVES"), "ESCRAVOS");
    ok("the panel", t("THE LEDGER OF THE TUSKEN"), "O LIVRO DOS TUSKEN");
    ok("the pens of the world", t("PENS ON TUSKARA"), "CERCOS EM TUSKARA");
    ok("what they pay", t("THEY PAY"), "ELES PAGAM");
    ok("the rate", t("EVERY 1,000"), "A CADA 1.000");
    ok("an empty ledger", t("None at work: the pens are full and nothing has been shipped."),
        "Nenhum em serviço: os cercos estão cheios e nada foi enviado.");
    ok("the worlds list", t("WORLDS HOLDING TUSKEN"), "MUNDOS COM TUSKEN");

    console.log("\n== what the server answers");

    ok("a price with a number in it", t("A transport costs 350 credits"), "Um transporte custa 350 créditos");
    ok("a fleet's price", t("A transport fleet costs 300 credits"), "Uma frota de transporte custa 300 créditos");
    ok("a spy's price", t("A spy costs 250 credits"), "Um espião custa 250 créditos");
    ok("the dust has room for no more", t("The dust will not feed another settlement: 3 stand already"),
        "A poeira não alimenta outro assentamento: 3 já estão de pé");
    ok("a load that cannot sail", t("An enemy fleet holds the orbit of Krieg: the load cannot sail"),
        "Uma frota inimiga domina a órbita de Krieg: a carga não pode zarpar");
    ok("an empty pen", t("There are no Tusken waiting at Tuskara"), "Não há tusken esperando em Tuskara");
    ok("a fleet that is not the right one",
        t("The Coffin Ships is not in port: a fleet at sea cannot take a load"),
        "A Coffin Ships não está no porto: uma frota no mar não pode levar carga");
    ok("a settlement rises", t("A settlement rises at Red Hollow, for 500 credits. Coffin Ships holds the orbit."),
        "Um assentamento nasce em Red Hollow, por 500 créditos. Coffin Ships domina a órbita.");
    ok("a hull joins a fleet", t("Old Hull joins the Coffin Ships, for 350 credits. The fleet now carries 2,500."),
        "Old Hull entra na Coffin Ships, por 350 créditos. A frota agora carrega 2,500.");
    ok("a load sails", t("2,500 Tusken aboard the Coffin Ships for Krieg — 1 hull, the trip costs nothing, 3m 20s on the road."),
        "2,500 tusken a bordo da Coffin Ships para Krieg — 1 cascos, a viagem não custa nada, 3m 20s na estrada.");
    ok("a refusal", t("A slaving fleet carries Tusken, not soldiers: no troops can be raised into it"),
        "Uma frota escravista leva tusken, não soldados: nenhuma tropa pode ser recrutada nela");
    ok("a spy comes back", t("Red Hollow is ours to read for 29m 59s: 4,000 in the pens, size 2, catch 3, hold 2 — the spy cost 250 credits."),
        "Red Hollow está aberto para nós por 29m 59s: 4,000 nos cercos, tamanho 2, captura 3, capacidade 2 — o espião custou 250 créditos.");

    console.log("\n== the reset button");

    ok("the button", t("RESET GAME"), "REINICIAR JOGO");
    ok("its warning", t("Type RESET to confirm."), "Digite RESET para confirmar.");
    ok("why it is hidden", t("Host only: puts the whole game back to the start"),
        "Somente o anfitrião: devolve o jogo inteiro ao início");

    console.log("\n== a text node, the way the page really shows it");

    const live = await page("pt", '<div id="x"><span>PENS ON TUSKARA</span><b>4 HULLS · 10,000 LIFT</b></div>');
    await wait(60);
    ok("a node in the page",
        live.window.document.getElementById("x").textContent.indexOf("CERCOS EM TUSKARA") !== -1,
        true);
    ok("and the numbers inside it",
        live.window.document.getElementById("x").textContent.indexOf("4 CASCOS · 10,000 CAPACIDADE") !== -1,
        true);

    console.log("\n== an English player is left alone");

    const en = await page("en");
    const te = en.window.t;

    ok("the board stays English", te("TUSKEN AT WORK"), "TUSKEN AT WORK");
    ok("a server answer stays English", te("A transport costs 350 credits"), "A transport costs 350 credits");
    ok("the reset stays English", te("RESET GAME"), "RESET GAME");

    console.log("\n== a proper noun is never renamed");

    ok("Tuskara", pt.window.t("Tuskara"), "Tuskara");
    ok("the Combine", pt.window.t("Combine"), "Combine");
    ok("a unit", pt.window.t("Knightmare"), "Knightmare");

    pt.window.close(); live.window.close(); en.window.close();

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);
}

main().catch(function (e) {
    console.log("\nCRASH: " + (e && e.stack ? e.stack : e));
    process.exit(1);
});
