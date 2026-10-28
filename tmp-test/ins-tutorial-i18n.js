/* One-off: insert the guide, the phone switch and the missing sentences into
   i18n.js. A key that is already there is never overwritten. */
const fs = require("fs");

const file = "i18n.js";
let s = fs.readFileSync(file, "utf8");

const marker = '            "Cada frota tua que esteja em órbita vai de uma vez para a doca: o tesouro paga por todas, ou não se repara nenhuma.",';

if (!s.includes(marker)) { throw new Error("marker not found in i18n.js"); }

const PAIRS = [
    /* the holes the coverage audit found */
    ["An election will be called as soon as a Freedom Authority player is online.",
        "Uma eleição é convocada assim que houver um jogador da Freedom Authority em linha."],
    ["LOYALTY", "LEALDADE"],
    ["soldiers", "soldados"],
    ["The chamber elects its own president with sql/2026-11-06_orbits_repairs_unrest_and_offices.sql. Run it, then reload this page.",
        "A câmara elege o seu próprio presidente com sql/2026-11-06_orbits_repairs_unrest_and_offices.sql. Rode-o e recarregue esta página."],
    ["This commissar has not voted yet.", "Este comissário ainda não votou."],

    /* the guide's own furniture */
    ["GUIDE", "GUIA"],
    ["Eight steps through the Congress. Each one opens the tab it is about; come back here for the next.",
        "Oito passos pelo Congresso. Cada um abre o separador de que trata; volta aqui para o seguinte."],
    ["Eight steps through the Supreme Soviet. Each one opens the tab it is about; come back here for the next.",
        "Oito passos pelo Soviete Supremo. Cada um abre o separador de que trata; volta aqui para o seguinte."],
    ["GUIDE BACK", "ANTERIOR"],
    ["GUIDE NEXT", "SEGUINTE"],
    ["GUIDE GO THERE", "IR PARA LÁ"],
    ["GUIDE FINISH", "TERMINAR"],

    /* the Congress, step by step */
    ["THE CHAMBER", "A CÂMARA"],
    ["Every delegate seated in this dome is one vote. A bill needs a majority, and a few kinds need a supermajority. Bringing a bill never costs credits; what the bill does may.",
        "Cada delegado sentado nesta cúpula vale um voto. Uma proposta precisa de maioria e algumas precisam de maioria qualificada. Apresentar uma proposta nunca custa créditos; o que ela faz pode custar."],
    ["A PARTY, NOT A LONE VOICE", "UM PARTIDO, NÃO UMA VOZ SÓ"],
    ["Join a party in PARTY. Delegates lean with their party, the party with the most seats chairs the committees, and only a party's members may report its committee's bills.",
        "Entra num partido em PARTIDO. Os delegados inclinam-se com o partido, o partido com mais cadeiras preside às comissões, e só os membros de um partido podem relatar as propostas da sua comissão."],
    ["PROPOSING", "PROPOR"],
    ["In NEW PROPOSAL you bring a bill yourself, of any kind the chamber allows. If you hold no seat the factions still bring their own every few minutes.",
        "Em NOVA PROPOSTA apresentas uma proposta tu mesmo, do género que a câmara permitir. Se não tiveres cadeira, as facções continuam a trazer as suas a cada poucos minutos."],
    ["THE DOME", "A CÚPULA"],
    ["While a bill is live the dome moves: delegates are swayed by the debate, the standing of the parties and the Authority's popularity. Green seats are yes, red are no.",
        "Enquanto uma proposta está viva a cúpula mexe-se: os delegados são convencidos pelo debate, pela força dos partidos e pela popularidade da Autoridade. Verde é sim, vermelho é não."],
    ["THE VOTE", "A VOTAÇÃO"],
    ["At the vote a bill passes or fails, and a bill that passes is carried out at once: a war declared, a fleet authorised, credits moved.",
        "Na votação a proposta passa ou cai, e a que passa é executada de imediato: uma guerra declarada, uma frota autorizada, créditos movidos."],
    ["TWO CHAIRS, NOT ONE", "DUAS CADEIRAS, NÃO UMA"],
    ["The President leads the Freedom Authority and is elected by its players. The Speaker leads this chamber and holds the veto. Two people, two elections.",
        "O Presidente lidera a Freedom Authority e é eleito pelos seus jogadores. O Presidente da Câmara lidera esta câmara e detém o veto. Duas pessoas, duas eleições."],
    ["Three committees schedule the bills. The party in a chair may send one of its own bills straight to the vote, once a term. The President names three ministers, each of whom may act once a term.",
        "Três comissões agendam as propostas. O partido que preside pode mandar uma das suas propostas directamente à votação, uma vez por mandato. O Presidente nomeia três ministros, e cada um pode agir uma vez por mandato."],
    ["WORLDS YOU HOLD", "OS MUNDOS QUE DOMINAS"],
    ["A conquered world is administered on OCCUPIED WORLDS: relief raises its stability, unrest rises while no fleet of ours is in its orbit, and at a hundred it throws the occupation off.",
        "Um mundo conquistado é administrado em MUNDOS OCUPADOS: o alívio sobe a sua estabilidade, a agitação cresce enquanto nenhuma frota nossa estiver na sua órbita, e aos cem expulsa a ocupação."],
    ["THAT IS THE CONGRESS", "O CONGRESSO É ISTO"],
    ["Everything the chamber does is on these tabs, and taking part costs nothing: no credits to propose, no credits to vote. The record of it all is on NEWS.",
        "Tudo o que a câmara faz está nestes separadores, e participar não custa nada: nada para propor, nada para votar. O registo de tudo está em NOTÍCIAS."],

    /* the Soviet, step by step */
    ["THE PLENUM", "O PLENO"],
    ["Every commissar in this hall is one vote, and a directive needs a qualified majority of the plenum. Putting one forward never costs credits; carrying it out may.",
        "Cada comissário nesta sala vale um voto, e uma directiva precisa de maioria qualificada do pleno. Apresentá-la nunca custa créditos; executá-la pode custar."],
    ["A CURRENT, NOT A LONE VOICE", "UMA CORRENTE, NÃO UMA VOZ SÓ"],
    ["Join a current in PARTY: the Proletarian Vanguard, the Party Apparatus, Red Command. The greatest current chairs the committees.",
        "Entra numa corrente em PARTIDO: a Vanguarda Proletária, o Aparato do Partido, o Comando Vermelho. A maior corrente preside às comissões."],
    ["DIRECTIVES", "DIRECTIVAS"],
    ["In NEW DIRECTIVE you bring one yourself. The currents bring their own as well, and the plenum sits only while a Combine player is online.",
        "Em NOVA DIRECTIVA apresentas uma tu mesmo. As correntes também trazem as suas, e o pleno só se reúne enquanto houver um jogador do Combine em linha."],
    ["THE SHOW OF HANDS", "O VOTO DE MÃOS"],
    ["While a directive is live the hall moves: the Soviet's confidence and its relations with the other side decide how the commissars lean, and the debate pulls them further.",
        "Enquanto uma directiva está viva a sala mexe-se: a confiança do Soviete e as suas relações com o outro lado decidem para onde os comissários se inclinam, e o debate puxa-os mais longe."],
    ["A carried directive is executed at once: a campaign authorised, a quota raised, a fleet ordered or struck from the rolls.",
        "Uma directiva aprovada é executada de imediato: uma campanha autorizada, uma quota subida, uma frota encomendada ou riscada dos registos."],
    ["The High Commissar leads the Combine and is elected by its players. The Secretary presides over the plenum and holds the veto. Two offices, two elections.",
        "O Alto Comissário lidera o Combine e é eleito pelos seus jogadores. O Secretário preside ao pleno e detém o veto. Dois cargos, duas eleições."],
    ["Three committees schedule the directives, and the current in a chair may report one straight to the vote once a term. The High Commissar names the ministers.",
        "Três comissões agendam as directivas, e a corrente que preside pode relatar uma directamente à votação uma vez por mandato. O Alto Comissário nomeia os ministros."],
    ["WORLDS TAKEN", "OS MUNDOS TOMADOS"],
    ["A world the Combine pacifies is administered on OCCUPIED WORLDS, and every world fully pacified sends one more commissar to this hall.",
        "Um mundo que o Combine pacifique é administrado em MUNDOS OCUPADOS, e cada mundo totalmente pacificado envia mais um comissário para esta sala."],
    ["THAT IS THE SOVIET", "O SOVIETE É ISTO"],
    ["Everything the Combine does is on these tabs, and taking part costs nothing: no credits to propose, no credits to vote. The record of it all is on AGITPROP and NEWS.",
        "Tudo o que o Combine faz está nestes separadores, e participar não custa nada: nada para propor, nada para votar. O registo de tudo está em AGITPROP e NOTÍCIAS."],

    /* the phone switch */
    ["PHONE MODE", "MODO TELEMÓVEL"],
    ["DESKTOP MODE", "MODO COMPUTADOR"]
];

const existing = new Set();
{
    const re = /^\s*"((?:[^"\\]|\\.)*)"\s*:/gm;
    let m;
    while ((m = re.exec(s))) { existing.add(m[1]); }
}

const added = [];
const skipped = [];

const lines = [];
for (const [en, pt] of PAIRS) {
    if (existing.has(en)) { skipped.push(en); continue; }
    added.push(en);
    lines.push("        " + JSON.stringify(en) + ": " + JSON.stringify(pt) + ",");
}

if (!lines.length) {
    console.log("nothing to add");
    process.exit(0);
}

const block = marker + "\n\n        /* ---------- the guide, the phone switch, and the holes (2026-11-17) ---------- */\n" +
    lines.join("\n");

s = s.replace(marker, block);
fs.writeFileSync(file, s);

console.log("added " + added.length + " keys, skipped " + skipped.length + " already present");
if (skipped.length) { console.log("  skipped: " + skipped.slice(0, 8).join(" | ")); }
