/* =========================================================
   GALACTIC FRONT — Portuguese (pt-BR)
   ---------------------------------------------------------
   The whole interface is translated at runtime, without touching
   the game logic: every text node, placeholder, title and alt in
   the page is matched against the dictionary below and replaced.

   Rules:
     - only exact matches (or the prefixes listed in PREFIX) are
       translated, so player names, commander names, faction names,
       planet names, unit names and the game title are never
       touched;
     - anything with data-no-i18n is skipped, and the same goes for
       <script>, <style>, <pre> and <code>;
     - content created later (panels, toasts, battle logs) is
       translated as it appears.

   To leave a string in English, just do not add it here.
   To keep a proper noun, write it into the translation itself.
========================================================= */
(function () {
    "use strict";

    const DICT = {

        /* ---------- menu / account ---------- */
        "MAIN MENU": "MENU PRINCIPAL",

        /* ---------- the front page ---------- */
        "WHAT IS ON THE PAGE": "O QUE ESTÁ NA PÁGINA",
        "The page is empty.": "A página está vazia.",
        "MAKE IT THE LEAD": "TORNAR MANCHETE",
        "IT IS THE LEAD": "É A MANCHETE",
        "OFF THE FRONT PAGE": "TIRAR DA PRIMEIRA PÁGINA",
        "YOUR DISPATCHES": "SEUS DESPACHOS",
        "You have filed nothing yet.": "Você ainda não enviou nada.",
        "The editor's note:": "Nota do editor:",
        "TAKE IT BACK": "RETIRAR",
        "ENTER GALACTIC FRONT": "ENTRAR NO GALACTIC FRONT",
        "CHOOSE YOUR FACTION": "ESCOLHA SUA FACÇÃO",
        "CHANGE FACTION": "MUDAR FACÇÃO",
        "YOUR FACTION": "SUA FACÇÃO",
        "Faction:": "Facção:",
        "FLEET COST": "CUSTO DE FROTA",

        "A story needs a headline": "Uma notícia precisa de uma manchete",
        "A story needs some words under the headline":
            "Uma notícia precisa de palavras sob a manchete",
        "A picture has to be an http(s) link": "Uma imagem precisa ser um link http(s)",
        "Fleet cost:": "Custo de frota:",

        "Only the host writes the front page": "Só o anfitrião escreve a primeira página",
        "Only the host allows a dispatch into the paper": "Só o anfitrião deixa um despacho entrar no jornal",
        "Only the host turns a dispatch away": "Só o anfitrião recusa um despacho",
        "Only the host takes a story off the front page": "Só o anfitrião tira uma notícia da primeira página",
        "Only the host decides the lead story": "Só o anfitrião decide a manchete principal",
        "Your faction's credits:": "Créditos da sua facção:",
        "COMMANDER ACCOUNT": "CONTA DO COMANDANTE",
        "SET USERNAME": "DEFINIR NOME",
        "Your username": "Seu nome de usuário",
        "your name in the game (3-20)": "seu nome no jogo (3-20)",
        "commander name or email": "nome de comandante ou e-mail",
        "password (6+ characters)": "senha (6+ caracteres)",
        "LOG IN": "ENTRAR",
        "LOG OUT": "SAIR",
        "SAVE / CREATE": "SALVAR / CRIAR",
        "A strategic map where players track the control of planets and individual cities across the galaxy.":
            "Um mapa estratégico onde os jogadores acompanham o controle dos planetas e das cidades individuais pela galáxia.",
        "Guest session. Save an account to keep this player ID forever.":
            "Sessão de convidado. Salve uma conta para manter este ID de jogador para sempre.",
        "Logged in as": "Conectado como",
        "Logged in.": "Conectado.",
        "You are already logged in.": "Você já está conectado.",
        "Account saved. Log in with this name (or email) and password anywhere.":
            "Conta salva. Entre com este nome (ou e-mail) e senha em qualquer lugar.",
        "Name: at least 3 letters or numbers (or use an email).":
            "Nome: pelo menos 3 letras ou números (ou use um e-mail).",
        "Password: at least 6 characters.": "Senha: pelo menos 6 caracteres.",
        "That email does not look right.": "Esse e-mail não parece correto.",
        "Saved.": "Salvo.",
        "Could not save your player data.": "Não foi possível salvar os dados do jogador.",
        "Could not change faction.": "Não foi possível mudar de facção.",
        "Could not connect to the game server.": "Não foi possível conectar ao servidor do jogo.",
        "Could not check your fleets.": "Não foi possível verificar suas frotas.",

        /* ---------- newer additions (upstream main) ---------- */
        "PRESIDENT": "PRESIDENTE",

        /* ---------- the front page (the newspaper) ---------- */
        "THE GALACTIC FRONT": "A FRENTE GALÁCTICA",
        "THE FRONT PAGE": "PRIMEIRA PÁGINA",
        "The front page": "A primeira página",
        "EDITOR'S DESK": "MESA DO EDITOR",
        "FILE A DISPATCH": "ENVIAR DESPACHO",
        "the editor holds the pen": "o editor segura a pena",
        "your desk files dispatches": "seu gabinete envia despachos",
        "the front page of the war": "a primeira página da guerra",
        "story printed": "notícia impressa",
        "stories printed": "notícias impressas",
        "The presses are cold: nothing has gone to print yet.":
            "As prensas estão frias: nada foi impresso ainda.",
        "Write the first story at the EDITOR'S DESK.": "Escreva a primeira notícia na MESA DO EDITOR.",
        "Or file a dispatch: the editor decides.": "Ou envie um despacho: o editor decide.",
        "The front page is the paper of the whole war: the host writes it, and the two faction leaders file dispatches that wait for the host to allow them.":
            "A primeira página é o jornal de toda a guerra: o anfitrião o escreve, e os dois líderes de facção enviam despachos que aguardam a autorização do anfitrião.",
        "The front page has not been set up yet: run": "A primeira página ainda não foi instalada: rode",
        "then reload the page.": "depois recarregue a página.",
        "Talking to the printing press...": "Falando com a prensa...",
        "by": "por",
        "A commander": "Um comandante",
        "the editor": "o editor",
        "LEAD STORY": "MANCHETE PRINCIPAL",
        "rewritten by the editor": "reescrita pelo editor",
        "READ THE FULL STORY": "LER A NOTÍCIA INTEIRA",
        "CLOSE THE STORY": "FECHAR A NOTÍCIA",
        "WRITE THE STORY": "ESCREVER A NOTÍCIA",
        "REWRITE THE STORY": "REESCREVER A NOTÍCIA",
        "headline": "manchete",
        "the line under the headline": "a linha sob a manchete",
        "the story itself": "a notícia em si",
        "a picture: paste its link": "uma imagem: cole o link dela",
        "what the picture shows": "o que a imagem mostra",
        "PICK A PICTURE": "ESCOLHER IMAGEM",
        "LOCAL PICTURE": "IMAGEM LOCAL",
        "it shows here only unless it can be uploaded":
            "ela aparece só aqui, a menos que consiga ser enviada",
        "This project has no picture storage: put the picture online and paste its link.":
            "Este projeto não guarda imagens: coloque a imagem online e cole o link dela.",
        "Sending the picture...": "Enviando a imagem...",
        "The picture is up. It will show on every screen.":
            "A imagem subiu. Vai aparecer em todas as telas.",
        "The picture could not be uploaded": "Não foi possível enviar a imagem",
        "put it online and paste its link.": "coloque-a online e cole o link dela.",
        "Publishing...": "Publicando...",
        "Filing...": "Enviando...",
        "Party chosen.": "Partido escolhido.",

        "PUBLISH IT": "PUBLICAR",
        "SAVE THE STORY": "SALVAR A NOTÍCIA",
        "START A NEW STORY": "COMEÇAR UMA NOTÍCIA NOVA",
        "SEND IT TO THE EDITOR": "ENVIAR AO EDITOR",
        "START AGAIN": "COMEÇAR DE NOVO",
        "THE EDITOR'S TRAY": "A CESTA DO EDITOR",
        "Nothing has been filed: the tray is empty.": "Nada foi enviado: a cesta está vazia.",
        "PRINT IT": "IMPRIMIR",
        "REWRITE IT": "REESCREVER",
        "REWRITE": "REESCREVER",
        "The picture could not be uploaded: put it online and paste its link.":
            "Não foi possível enviar a imagem: coloque-a online e cole o link dela.",
        "TURN IT DOWN": "RECUSAR",
        "BURN IT": "QUEIMAR",
        "Tell the desk why it is not going in (or leave it empty):":
            "Diga ao gabinete por que não vai entrar (ou deixe vazio):",
        "EMPTY THE TRAY": "ESVAZIAR A CESTA",
        "Vetoed.": "Vetado.",
        "Vote cast.": "Voto registrado.",

        "of your dispatches is on the front page": "dos seus despachos está na primeira página",
        "of your dispatches are on the front page": "dos seus despachos estão na primeira página",
        "PRINTED": "IMPRESSO",
        "TURNED DOWN": "RECUSADO",
        "IN THE DRAWER": "NA GAVETA",
        "WAITING FOR THE EDITOR": "AGUARDANDO O EDITOR",
        "dispatch waiting": "despacho aguardando",
        "dispatches waiting": "despachos aguardando",
        "You are a candidate for President.": "Você é candidato à Presidência.",
        "Use your veto on this proposal? You can only veto once per term.":
            "Usar seu veto nesta proposta? Você só pode vetar uma vez por mandato.",
        "The Declaration of War is before Congress.": "A declaração de guerra está no Congresso.",

        "Only the host burns a story": "Só o anfitrião queima uma notícia",
        "Only the host empties the trays": "Só o anfitrião esvazia as cestas",
        "Only a faction leader files a dispatch": "Só um líder de facção envia um despacho",
        "The editor writes the paper directly": "O editor escreve o jornal diretamente",
        "Five of your dispatches are already waiting: wait for the editor":
            "Cinco despachos seus já estão aguardando: espere o editor",
        "That story is not in the paper": "Essa notícia não está no jornal",
        "That dispatch is not in the tray": "Esse despacho não está na cesta",
        "That story is not on the front page": "Essa notícia não está na primeira página",
        "That dispatch is not yours to take back": "Esse despacho não é seu para retirar",
        "Not authenticated": "Não autenticado",
        "High Commissar of the Combine": "Alto Comissário da Combine",
        "Return to the main menu?": "Voltar ao menu principal?",
        "A battle is still in progress. If you leave now it is abandoned. Return to the main menu anyway?":
            "Uma batalha ainda está em andamento. Se você sair agora ela será abandonada. Voltar ao menu principal mesmo assim?",
        "The leadership needs a moment before the next matter (":
            "A liderança precisa de um momento antes do próximo assunto (",
        "Relief for": "Ajuda para",
        "ALL REGIONS": "TODAS AS REGIÕES",
        "GROUP BY FACTION": "AGRUPAR POR FACÇÃO",
        "GROUP BY REGION": "AGRUPAR POR REGIÃO",
        "Your party": "Seu partido",
        "Last election": "Última eleição",
        "Winner:": "Vencedor:",
        "No candidates yet.": "Nenhum candidato ainda.",
        "The office is vacant.": "O cargo está vago.",
        "Presidential election": "Eleição presidencial",
        "President of the Freedom Authority": "Presidente da Freedom Authority",
        "Choose a party above first.": "Escolha um partido acima primeiro.",
        "Choose a party above to vote.": "Escolha um partido acima para votar.",
        "chosen target ·": "alvo escolhido ·",
        "Congress has no proposals yet. Write one in NEW PROPOSAL, or wait for the delegates.":
            "O Congresso ainda não tem propostas. Escreva uma em NOVA PROPOSTA ou aguarde os delegados.",
        "Congress sits only while a Freedom Authority player is online. The delegates bring proposals of their own every few minutes.":
            "O Congresso só funciona enquanto um jogador da Freedom Authority estiver online. Os delegados trazem propostas próprias a cada poucos minutos.",
        "Every Freedom Authority player belongs to a party. You need one to stand for President or to vote.":
            "Todo jogador da Freedom Authority pertence a um partido. Você precisa de um para se candidatar à Presidência ou votar.",
        "War room: declare war on a planet": "Sala de guerra: declarar guerra a um planeta",

        /* ---------- congress: propaganda ---------- */

        "TREASURY": "TESOURO",

        /* ---------- congress: the pieces a card builds itself ---------- */
        "supermajority": "maioria qualificada",
        "majority": "maioria simples",
        "free": "grátis",
        "by": "por",
        "spoken for by": "apresentada por",
        "INTRODUCTION": "APRESENTAÇÃO",

        "PASSED": "APROVADA",
        "REJECTED": "REJEITADA",
        "NO FUNDS": "SEM FUNDOS",
        "PRESIDENTIAL": "PRESIDENCIAL",
        "Debate opens in": "O debate abre em",
        "Vote in": "Votação em",
        "needs": "precisa de",
        "of": "de",
        "votes": "votos",
        "Your bribes:": "Seus subornos:",
        "These bars already include the opening fleet rule.":
            "Estas barras já incluem a regra das primeiras frotas.",
        "ABSTAIN": "ABSTENÇÃO",
        "needed": "necessários",
        "Scandal:": "Escândalo:",
        "VETO": "VETAR",

        /* ---------- congress: the delegate panel ---------- */
        "delegate of the occupied world": "delegado do mundo ocupado",
        "area": "área",
        "seat": "cadeira",
        "vote": "voto",
        "Chance the bribe works:": "Chance de o suborno funcionar:",
        "risk of a scandal:": "risco de escândalo:",
        "A bribe that fails is still lost.": "Um suborno que falha é perdido mesmo assim.",

        /* ---------- congress: the voting record ---------- */
        "VOTING HISTORY": "HISTÓRICO DE VOTOS",
        "Loading the voting record...": "Carregando o histórico de votos...",
        "The voting record is not installed yet: run sql/2026-10-27_delegate_history.sql in the Supabase SQL editor.":
            "O histórico de votos ainda não está instalado: execute sql/2026-10-27_delegate_history.sql no editor SQL do Supabase.",
        "bribes taken:": "subornos aceitos:",
        "This delegate has not voted yet.": "Este delegado ainda não votou.",
        "BOUGHT": "COMPRADO",

        /* ---------- congress: the tabs ---------- */
        "ELECTION": "ELEIÇÃO",
        "GUARANTEED: the Authority has no fleet, so every delegate votes yes.":
            "GARANTIDA: a Autoridade não tem frota, então todos os delegados votam sim.",
        "FAVOURED: the real odds are 35 points above the forecast while the Authority has fewer than five fleets.":
            "FAVORECIDA: as chances reais são 35 pontos acima da previsão enquanto a Autoridade tiver menos de cinco frotas.",
        "The propaganda offices": "Os gabinetes de propaganda",
        "Loading the propaganda offices...": "Carregando os gabinetes de propaganda...",
        "A campaign for this faction is still running:": "Ainda há uma campanha em curso para esta fação:",
        "Propaganda is paid from the Authority treasury. A campaign raises the loyalty of a faction's delegates and can pull delegates of other factions over to it. The same faction can be targeted once every ten minutes.":
            "A propaganda é paga pelo tesouro da Autoridade. Uma campanha aumenta a lealdade dos delegados de uma fação e pode trazer para ela delegados de outras fações. A mesma fação só pode ser alvo uma vez a cada dez minutos.",
        "A campaign lifts the loyalty of the faction's own delegates and wins over the least loyal delegates of the others (they join it, at its level of loyalty). More money means more points and more delegates.":
            "Uma campanha sobe a lealdade dos próprios delegados da fação e conquista os delegados menos leais das outras (eles passam-se para ela, ao nível de lealdade dela). Mais dinheiro significa mais pontos e mais delegados.",

        /* ---------- shared status words ---------- */
        "STATIONED": "ESTACIONADA",
        "TRAVELLING": "EM VIAGEM",
        "BUILDING": "EM CONSTRUÇÃO",
        "READY": "PRONTA",
        "AUTH ERROR": "ERRO DE AUTENTICAÇÃO",
        "NOT AUTHENTICATED": "NÃO AUTENTICADO",
        "FLEET DATABASE ERROR": "ERRO NA BASE DE FROTAS",
        "PLAYER AUTHENTICATION FAILED.": "FALHA NA AUTENTICAÇÃO DO JOGADOR.",
        "You are not authenticated.": "Você não está autenticado.",
        "Not authenticated.": "Não autenticado.",
        "SAVE FAILED": "FALHA AO SALVAR",
        "Loading...": "Carregando...",
        "Loading fleet...": "Carregando frota...",
        "Loading fleets...": "Carregando frotas...",
        "ETA:": "PREVISÃO:",

        "Location:": "Localização:",
        "Cities:": "Cidades:",
        "Provinces:": "Províncias:",
        "None yet.": "Nenhum ainda.",
        "no answer": "sem resposta",

        /* ---------- galaxy map ---------- */
        "GALACTIC MAP": "MAPA GALÁCTICO",
        "GALACTIC STATUS": "STATUS GALÁCTICO",
        "ACTIVE SYSTEMS": "SISTEMAS ATIVOS",
        "ACTIVE BATTLES": "BATALHAS ATIVAS",
        "CONTESTED CITIES": "CIDADES DISPUTADAS",
        "FACTION CREDITS:": "CRÉDITOS DA FACÇÃO:",
        "LOSSES": "PERDAS",
        "USERNAME": "NOME DE USUÁRIO",
        "credits": "créditos",
        "CREDITS": "CRÉDITOS",
        "FLEETS": "FROTAS",
        "SEATS": "CADEIRAS",
        "NEEDED": "NECESSÁRIOS",
        "CREATE": "CRIAR",
        "CANCEL": "CANCELAR",
        "NOTICE": "AVISO",
        "BATTLE IN PROGRESS": "BATALHA EM ANDAMENTO",
        "RETURN": "VOLTAR",
        "LEAVE": "SAIR",
        "FACTION CREDITS: —": "CRÉDITOS DA FACÇÃO: —",
        "ACTIVE FLEET": "FROTA ATIVA",
        "FLEET RECRUITMENT": "RECRUTAMENTO DE FROTA",
        "DIVISION TYPES": "TIPOS DE DIVISÃO",
        "Click a planet to enter its planetary map.": "Clique em um planeta para entrar no mapa planetário.",
        "Could not load fleets.": "Não foi possível carregar as frotas.",
        "No fleets are currently stationed at this planet.": "Nenhuma frota está estacionada neste planeta.",
        "No fleet specified.": "Nenhuma frota especificada.",
        "You do not command this fleet.": "Você não comanda esta frota.",
        "Fleet is already there.": "A frota já está lá.",
        "Fleet is not stationed.": "A frota não está estacionada.",
        "Fleet must be stationed.": "A frota precisa estar estacionada.",
        "Fleet is not at this planet.": "A frota não está neste planeta.",
        "Fleet is not ready for battle.": "A frota não está pronta para a batalha.",
        "Fleet has no divisions.": "A frota não tem divisões.",
        "This fleet has no units.": "Esta frota não tem unidades.",
        "This fleet belongs to another faction.": "Esta frota pertence a outra facção.",
        "Fleet capacity is 20 units.": "A capacidade da frota é de 20 unidades.",
        "Sending fleet...": "Enviando frota...",
        "SEND FLEET": "ENVIAR FROTA",
        "RIGHT-CLICK ANYWHERE ON THE MAP TO SEND THIS FLEET":
            "CLIQUE COM O BOTÃO DIREITO EM QUALQUER LUGAR DO MAPA PARA ENVIAR ESTA FROTA",
        "Fleet travelling. ETA": "Frota em viagem. Previsão",
        "Fleet under way. ETA": "Frota em rota. Previsão",
        "Could not load fleet.": "Não foi possível carregar a frota.",
        "Could not reload fleet.": "Não foi possível recarregar a frota.",
        "Could not verify your fleet.": "Não foi possível verificar sua frota.",
        "Recruiting": "Recrutando",
        "TRAINING:": "TREINAMENTO:",
        "UNITS:": "UNIDADES:",
        "UNITS: —": "UNIDADES: —",
        "BUILT ✓": "CONSTRUÍDO ✓",
        "MAXIMUM LEVEL": "NÍVEL MÁXIMO",

        /* ---------- planet / building ---------- */
        "PLANET": "PLANETA",
        "PLANETARY MAP": "MAPA PLANETÁRIO",
        "RETURN TO PLANET": "VOLTAR AO PLANETA",
        "BACK TO GALACTIC MAP": "VOLTAR AO MAPA GALÁCTICO",
        "← GALAXY": "← GALÁXIA",
        "CREATE FLEET": "CRIAR FROTA",
        "CONSTRUCTING FLEET...": "CONSTRUINDO FROTA...",
        "ENTER A FLEET NAME.": "DIGITE UM NOME PARA A FROTA.",
        "Fleet name": "Nome da frota",
        "Construction time: 1 minute": "Tempo de construção: 1 minuto",
        "This fleet will be constructed at": "Esta frota será construída em",
        "this planet": "este planeta",
        "After construction, it will be stationed here until you order it to move from the Galactic Map.":
            "Depois de construída, ela ficará estacionada aqui até você ordenar que se mova pelo Mapa Galáctico.",
        "Could not complete fleet construction.": "Não foi possível concluir a construção da frota.",
        "Could not build:": "Não foi possível construir:",
        "Could not upgrade garrison:": "Não foi possível melhorar a guarnição:",
        "Requirements not met": "Requisitos não atendidos",
        "Requires a Heavy Vehicle Factory on this planet": "Requer uma Fábrica de Veículos Pesados neste planeta",
        "Requires a Vehicle Factory on this planet": "Requer uma Fábrica de Veículos neste planeta",
        "Requires a complete Knightmare Facility (with Speeder Wheel, Frame and Controls) on this planet. One squad = 3 mechs.":
            "Requer uma Instalação Knightmare completa (com Roda Speeder, Chassi e Controles) neste planeta. Um esquadrão = 3 mechs.",
        "100 CR • 60s": "100 CR • 60s",
        "100 CR • 90s • VEHICLE FACTORY": "100 CR • 90s • FÁBRICA DE VEÍCULOS",
        "125 CR • 75s": "125 CR • 75s",
        "150 CR • 120s • HEAVY FACTORY": "150 CR • 120s • FÁBRICA PESADA",
        "150 CR • 90s": "150 CR • 90s",
        "1500 CR • 120s • KNIGHTMARE FACILITY": "1500 CR • 120s • INSTALAÇÃO KNIGHTMARE",
        "50 CR • 30s": "50 CR • 30s",
        "75 CR • 40s": "75 CR • 40s",
        "Held by:": "Controlada por:",
        "Garrison level": "Nível da guarnição",
        "Upgrade garrison": "Melhorar guarnição",
        "Building": "Construindo",

        /* ---------- city battle ---------- */
        "CITY BATTLE": "BATALHA URBANA",
        "CITY CAPTURED": "CIDADE CAPTURADA",
        "ENTER BATTLE": "ENTRAR NA BATALHA",
        "CONTACT LOST": "CONTATO PERDIDO",
        "DEFEAT": "DERROTA",
        "VICTORY": "VITÓRIA",
        "TACTICAL OBJECTIVE SECURED": "OBJETIVO TÁTICO CONQUISTADO",
        "Enemy forces eliminated.": "Forças inimigas eliminadas.",
        "Your attacking force was defeated.": "Sua força de ataque foi derrotada.",
        "Victory secured. Occupying": "Vitória garantida. Ocupando",
        "Connecting to the battle...": "Conectando à batalha...",
        "Saving battle result...": "Salvando resultado da batalha...",
        "Battle result saved.": "Resultado da batalha salvo.",
        "The battle ended, but the result could not be saved.":
            "A batalha terminou, mas o resultado não pôde ser salvo.",
        "Could not save battle result:": "Não foi possível salvar o resultado da batalha:",
        "Could not enter the battle:": "Não foi possível entrar na batalha:",
        "Could not join the battle:": "Não foi possível juntar-se à batalha:",
        "Could not start battle:": "Não foi possível iniciar a batalha:",
        "The player running this battle is no longer connected. You can take command (the battle restarts from your fleets as they were) or leave and keep your fleet frozen for later.":
            "O jogador que conduzia esta batalha não está mais conectado. Você pode assumir o comando (a batalha recomeça com suas frotas como estavam) ou sair e manter sua frota congelada para depois.",
        "The battle commander stopped responding. Your fleet was not committed.":
            "O comandante da batalha parou de responder. Sua frota não foi comprometida.",
        "You command the battle. Ships of fleets whose players are absent are flown by the AI.":
            "Você comanda a batalha. As naves de frotas cujos jogadores estão ausentes são pilotadas pela IA.",
        "Joined the battle. Waiting for the battle commander...":
            "Entrou na batalha. Aguardando o comandante da batalha...",
        "Your divisions are in the battle. Select them and give orders.":
            "Suas divisões estão na batalha. Selecione-as e dê ordens.",
        "The battle is over.": "A batalha acabou.",
        "No battle specified.": "Nenhuma batalha especificada.",
        "No losses recorded.": "Nenhuma perda registrada.",
        "Calculating losses...": "Calculando perdas...",
        "Saving your fleet...": "Salvando sua frota...",
        "TAKE COMMAND": "ASSUMIR O COMANDO",
        "Reinforcing the": "Reforçando a",
        "Reinforcements have arrived for the": "Reforços chegaram para a",
        "Initial force: 5 Rifle Squads + 1 MG Squad": "Força inicial: 5 Esquadrões Rifle + 1 Esquadrão MG",
        "Battle started. Garrison level": "Batalha iniciada. Nível da guarnição",
        "Your losses:": "Suas perdas:",
        "Your losses": "Suas perdas",
        "divisions attacking.": "divisões atacando.",
        "divisions selected.": "divisões selecionadas.",
        ". Select your divisions.": ". Selecione suas divisões.",
        "YOU MUST CONTROL THIS PLANET.": "VOCÊ PRECISA CONTROLAR ESTE PLANETA.",
        "You need a completed fleet stationed at this planet to attack.":
            "Você precisa de uma frota completa estacionada neste planeta para atacar.",
        "You need a completed fleet stationed at this planet to join the battle.":
            "Você precisa de uma frota completa estacionada neste planeta para entrar na batalha.",

        /* ---------- space battle ---------- */
        "Space Battle": "Batalha Espacial",
        "⚔ BATTLE FOR": "⚔ BATALHA POR",
        "⚔ SPACE BATTLE:": "⚔ BATALHA ESPACIAL:",
        "YOUR REPLY": "SUA RESPOSTA",
        "Light battery": "Bateria leve",
        "Broadside battery": "Bateria lateral",
        "a weapon system is knocked out": "um sistema de armas foi destruído",
        "engines damaged": "motores danificados",
        "fires on deck": "incêndio no convés",
        "A fitting offering of words.": "Uma oferenda de palavras adequada.",
        "A friend of the faithful. Come closer.": "Um amigo dos fiéis. Aproxime-se.",

        /* ---------- war / factions ---------- */
        "Show respect": "Mostrar respeito",
        "Pledge support": "Prometer apoio",
        "Slander a rival": "Difamar um rival",
        "Threaten": "Ameaçar",
        "Ask about the war": "Perguntar sobre a guerra",
        "We respect what you have built here.": "Respeitamos o que você construiu aqui.",
        "Our faction stands ready to back you.": "Nossa facção está pronta para apoiar você.",
        "Your rivals are treacherous. Do not trust them.": "Seus rivais são traiçoeiros. Não confie neles.",
        "Cross us and you will regret it.": "Fique contra nós e vai se arrepender.",
        "What is the situation on your front?": "Qual é a situação na sua frente?",
        "Standing": "Reputação",
        "FACTION:": "FACÇÃO:",
        "CONTESTED:": "DISPUTADAS:",
        "and finally": "e finalmente",
        "build from the galaxy map": "construir no mapa galáctico",
        "recruit into a fleet": "recrutar para uma frota",
        "· decisions are paid from this pool": "· as decisões são pagas deste fundo",
        "⟲ RESET GAME": "⟲ REINICIAR JOGO",
        "⚔ SPACE BATTLE": "⚔ BATALHA ESPACIAL",
        "Congress has not declared war on": "O Congresso não declarou guerra contra",
        "Your session expired.": "Sua sessão expirou.",
        "This fleet belongs to the": "Esta frota pertence à",
        "The reset finished, but some parts could not be done:":
            "A reinicialização terminou, mas algumas partes não puderam ser feitas:",
        "WAR ROOM": "SALA DE GUERRA",
        "WAR DECLARED": "GUERRA DECLARADA",
        "RECENT DECISIONS": "DECISÕES RECENTES",
        "PROPOSE WAR": "PROPOR GUERRA",
        "PROPOSE RELIEF (+10 stability)": "PROPOR AJUDA (+10 estabilidade)",
        "📡 Open comms": "📡 Abrir comunicações",
        "Relationship with you:": "Relação com você:",
        "Help this faction": "Ajudar esta facção",
        "Work against this faction": "Trabalhar contra esta facção",
        "No assault underway.": "Nenhum assalto em andamento.",
        "No faction can take a city on its own. Open the FACTIONS tab to back an assault.":
            "Nenhuma facção consegue tomar uma cidade sozinha. Abra a aba FACÇÕES para apoiar um assalto.",
        "Chance of success:": "Chance de sucesso:",
        "The war is over.": "A guerra acabou.",
        "front line": "linha de frente",
        "city under siege": "cidade sitiada",
        "aggregate losses": "perdas acumuladas",
        "force ceasefire (": "forçar cessar-fogo (",
        "Force ceasefire (": "Forçar cessar-fogo (",
        "Sabotage attacker (": "Sabotar atacante (",
        "Send relief (": "Enviar ajuda (",
        "No targets.": "Nenhum alvo.",
        "no targets": "nenhum alvo",
        "· held by": "· controlada por",
        "Backed by:": "Apoiada por:",
        "▼ FACTIONS": "▼ FACÇÕES",
        "▶ FACTIONS": "▶ FACÇÕES",
        "◀ FACTIONS": "◀ FACÇÕES",

        /* ---------- congress ---------- */
        "CONGRESS": "CONGRESSO",
        "PROPOSALS": "PROPOSTAS",
        "NEW PROPOSAL": "NOVA PROPOSTA",
        "OCCUPIED WORLDS": "MUNDOS OCUPADOS",
        "AUTHORITY": "AUTORIDADE",
        "NEWS": "NOTÍCIAS",
        "SELECTED FOR BRIBES": "SELECIONADA PARA SUBORNO",
        "SELECT TO BRIBE DELEGATES": "SELECIONAR PARA SUBORNAR DELEGADOS",
        "DELEGATES": "DELEGADOS",
        "FREEDOM AUTHORITY CONGRESS": "CONGRESSO DA FREEDOM AUTHORITY",
        "Freedom Authority Congress": "Congresso da Freedom Authority",
        "THE CHAMBER": "A CÂMARA",
        "Congress is not available": "O Congresso não está disponível",
        "Only Freedom Authority players have a Congress, and stage15.sql must have been run.":
            "Apenas jogadores da Freedom Authority têm um Congresso, e o stage15.sql precisa ter sido executado.",
        "Click a delegate to see who they are. While a proposal is in debate you can try to win their vote.":
            "Clique em um delegado para ver quem ele é. Enquanto uma proposta está em debate, você pode tentar conquistar o voto dele.",
        "Rumours of corruption surround this delegate.": "Rumores de corrupção cercam este delegado.",
        "suspected of corruption": "suspeito de corrupção",

        /* ---------- congress: the debate ---------- */
        "voting yes": "vota sim",
        "voting no": "vota não",
        "UNDECIDED": "INDECISOS",
        "COST:": "CUSTO:",

        /* ---------- congress: election, occupied worlds, authority ---------- */
        "seats": "cadeiras",
        "loyalty": "lealdade",
        "— THE CHAMBER'S CHOICE —": "— A ESCOLHA DA CÂMARA —",
        "THE MINISTRY": "O MINISTÉRIO",
        "delegates seated": "delegados sentados",
        "turns (5 minutes each, only counted while stability is high enough)":
            "turnos (5 minutos cada, contados apenas enquanto a estabilidade for alta o suficiente)",
        "OCCUPIED": "OCUPADO",
        "CIVILIAN ADMIN": "ADMINISTRAÇÃO CIVIL",
        "PROTECTED": "PROTEGIDO",
        "INTEGRATED": "INTEGRADO",
        "Target:": "Alvo:",
        "held by": "controlada por",
        "No target chosen yet.": "Nenhum alvo escolhido ainda.",
        "war is one of their priorities": "a guerra é uma das prioridades deles",
        "not a priority for them": "não é uma prioridade para eles",
        "(it shifts every vote by up to ±10 points: a popular Authority gets its way more often)":
            "(muda cada votação em até ±10 pontos: uma Autoridade popular consegue o que quer com mais frequência)",
        "relations:": "relações:",
        "term": "mandato",
        "term ends in": "o mandato termina em",
        "(you)": "(você)",
        "left": "restantes",
        "Players:": "Jogadores:",
        "none yet": "nenhum ainda",
        "party members have voted (only players vote)": "membros de partido já votaram (só jogadores votam)",
        "players declare their candidacy, then everybody votes": "os jogadores declaram a candidatura e depois todos votam",
        "CAMPAIGN": "CAMPANHA",
        "VOTING": "VOTAÇÃO",
        "YOUR VOTE": "SEU VOTO",
        "VOTE": "VOTAR",
        "YOU ARE A CANDIDATE": "VOCÊ É CANDIDATO",
        "RUN FOR PRESIDENT": "CANDIDATAR-SE À PRESIDÊNCIA",
        "The President may keep 5 proposals before Congress (others 3), has used the veto of this term, and the ruling party's agenda is heard more often. State initiatives for new fleets and squads go to the President.":
            "O Presidente pode manter 5 propostas no Congresso (os outros 3), já usou o veto deste mandato e a agenda do partido do governo é ouvida com mais frequência. As iniciativas do Estado por novas frotas e esquadrões vão para o Presidente.",
        "The President may keep 5 proposals before Congress (others 3), may veto one proposal per term, and the ruling party's agenda is heard more often. State initiatives for new fleets and squads go to the President.":
            "O Presidente pode manter 5 propostas no Congresso (os outros 3), pode vetar uma proposta por mandato e a agenda do partido do governo é ouvida com mais frequência. As iniciativas do Estado por novas frotas e esquadrões vão para o Presidente.",
        "VOTES NEEDED:": "VOTOS NECESSÁRIOS:",
        "PROPOSE WAR": "PROPOR GUERRA",
        "the floor is still moving": "o plenário ainda se mexe",
        "Fully integrated into the Authority: the world has sent two more delegates to Congress.":
            "Totalmente integrado à Autoridade: o mundo enviou mais dois delegados ao Congresso.",
        "BRIBE FOR:": "SUBORNO PARA:",
        "buy a YES": "comprar um SIM",
        "buy a NO": "comprar um NÃO",
        "OFFER": "OFERECER",
        "Bribes can only be offered while the selected proposal is in debate.":
            "Subornos só podem ser oferecidos enquanto a proposta selecionada estiver em debate.",
        "Select a proposal in debate (PROPOSALS tab) to bribe this delegate.":
            "Selecione uma proposta em debate (aba PROPOSTAS) para subornar este delegado.",
        "· risk of a scandal:": "· risco de escândalo:",
        "Nothing has happened yet.": "Nada aconteceu ainda.",
        "Congress has no proposals yet. Write one in NEW PROPOSAL; delegates also bring proposals of their own.":
            "O Congresso ainda não tem propostas. Escreva uma em NOVA PROPOSTA; os delegados também trazem as suas.",
        "Forecast: about": "Previsão: cerca de",
        "yes votes (chance of a YES per faction, before bribes and surprises).":
            "votos sim (chance de SIM por facção, antes de subornos e surpresas).",
        "WHAT DO YOU WANT CONGRESS TO DO?": "O QUE VOCÊ QUER QUE O CONGRESSO FAÇA?",
        "TARGET PLANET": "PLANETA ALVO",
        "WHICH WORLD?": "QUAL MUNDO?",
        "all occupied worlds": "todos os mundos ocupados",
        "ENVOYS TO": "ENVIADOS PARA",
        "FLEET TO DECOMMISSION": "FROTA A DESATIVAR",
        "you have no fleets": "você não tem frotas",
        "WHICH FACTION SPEAKS FOR IT?": "QUAL FACÇÃO APRESENTA A PROPOSTA?",
        "Delegates of the sponsoring faction vote for it far more often; factions near it in outlook tend to follow, distant ones oppose.":
            "Os delegados da facção proponente votam a favor com muito mais frequência; facções próximas em ideologia tendem a acompanhar, as distantes se opõem.",
        "· VOTES NEEDED:": "· VOTOS NECESSÁRIOS:",
        "Introduction 1 minute, then 5 minutes of debate (bribes are possible), then the vote. You can have 3 proposals before Congress at once.":
            "Apresentação de 1 minuto, depois 5 minutos de debate (subornos são possíveis) e então a votação. Você pode ter 3 propostas no Congresso ao mesmo tempo.",
        "PUT BEFORE CONGRESS": "LEVAR AO CONGRESSO",
        "Planets you could declare war on": "Planetas contra os quais você pode declarar guerra",
        "The four factions": "As quatro facções",
        "The Authority holds no occupied worlds. When Freedom Authority fleets conquer every city of a planet, it is placed under occupation and moves through four stages:":
            "A Autoridade não controla nenhum mundo ocupado. Quando frotas da Freedom Authority conquistam todas as cidades de um planeta, ele entra em ocupação e passa por quatro estágios:",
        ". Each stage takes time and enough stability (relief proposals raise it), and each earns the planet delegates in Congress.":
            ". Cada estágio exige tempo e estabilidade suficiente (propostas de ajuda a aumentam), e cada um rende delegados do planeta no Congresso.",
        "votes needed: majority / supermajority": "votos necessários: maioria / maioria qualificada",
        "AUTHORISED FLEETS": "FROTAS AUTORIZADAS",
        "AUTHORISED KNIGHTMARE SQUADS": "ESQUADRÕES KNIGHTMARE AUTORIZADOS",
        "WAR DECLARATIONS": "DECLARAÇÕES DE GUERRA",
        "Your proposal is before Congress.": "Sua proposta está no Congresso.",
        "Offer made (": "Oferta feita (",
        "Already offered:": "Já oferecido:",
        "Defection:": "Deserção:",
        "TAX LEVEL": "NÍVEL DE IMPOSTOS",
        "POPULARITY": "POPULARIDADE",
        "STABILITY": "ESTABILIDADE",
        "STAGE PROGRESS": "PROGRESSO DO ESTÁGIO",
        "YES": "SIM",
        "NO": "NÃO",
        "occupied": "ocupado",
        "civilian administration": "administração civil",
        "protected": "protegido",
        "integrated": "integrado",

        /* ---------- congress: the kinds of bill, and the small print ---------- */
        "Declaration of War on Planet": "Declaração de guerra a um planeta",
        "Authorize New Fleet Construction": "Autorizar a construção de uma nova frota",
        "Authorize Knightmare Squad Formation": "Autorizar a formação de um esquadrão Knightmare",
        "Emergency Economic Relief": "Ajuda econômica de emergência",
        "Diplomatic Mission Proposal": "Missão diplomática",
        "Taxation Increase Proposal": "Proposta de aumento de impostos",
        "Military Asset Recall and Decommission": "Recolhimento e desativação de ativo militar",
        "Authorize a military strike on a specific planet. Without it Freedom Authority fleets cannot attack.":
            "Autoriza um ataque militar a um planeta específico. Sem isso, as frotas da Freedom Authority não podem atacar.",
        "Approve one new military fleet (build it from the galaxy map afterwards).":
            "Aprova uma nova frota militar (construa-a depois no mapa galáctico).",
        "Approve one elite Knightmare squad (the Knightmare Facility chain is still needed).":
            "Aprova um esquadrão Knightmare de elite (a cadeia da Instalação Knightmare ainda é necessária).",
        "Civilian relief for occupied worlds: stability +10.":
            "Ajuda civil para os mundos ocupados: estabilidade +10.",
        "Send envoys to another faction: relations +10.":
            "Envia emissários a outra facção: relações +10.",
        "Raise taxes on the member worlds: 300-500 credits every 15 minutes per level (max 2), popularity -5.":
            "Aumenta os impostos dos mundos membros: 300-500 créditos a cada 15 minutos por nível (máximo 2), popularidade -5.",
        "Recall and dismantle one of your fleets for 500 credits of salvage.":
            "Recolhe e desmonta uma das suas frotas em troca de 500 créditos de sucata.",
        "this is one of their priorities": "esta é uma das prioridades deles",
        "delegates": "delegados",
        "campaign": "campanha",
        "campaigns": "campanhas",
        "credits spent": "créditos gastos",
        "Only players write a Declaration of War (the delegates never do); Congress then votes on it, and a majority is enough. Without a passed declaration Freedom Authority fleets cannot attack a planet. Click a planet on the map.":
            "Só os jogadores apresentam uma declaração de guerra (os delegados nunca o fazem); o Congresso vota-a depois e a maioria simples basta. Sem uma declaração aprovada, as frotas da Freedom Authority não podem atacar um planeta. Clique em um planeta no mapa.",
        "war declared · blue = Authority, red = Combine, white = independent worlds":
            "guerra declarada · azul = Freedom Authority, vermelho = Combine, branco = mundos independentes",
        "Ring colour = occupation stage (gold occupied, light blue civilian administration, violet protected, green integrated)":
            "Cor do anel = estágio de ocupação (dourado ocupado, azul-claro administração civil, violeta protegido, verde integrado)",

        /* ---------- the Combine's Supreme Soviet ---------- */
        "SUPREME SOVIET OF THE COMBINE": "SOVIETE SUPREMO DO COMBINE",
        "Supreme Soviet of the Combine": "Soviete Supremo do Combine",
        "SUPREME SOVIET": "SOVIETE SUPREMO",
        "THE PLENUM": "O PLENO",
        "HIGH COMMISSAR": "ALTO COMISSÁRIO",
        "CONFIDENCE": "CONFIANÇA",
        "QUOTA": "COTA",
        "DIRECTIVES": "DIRETIVAS",
        "NEW DIRECTIVE": "NOVA DIRETIVA",
        "discipline": "disciplina",
        "DISCIPLINE": "DISCIPLINA",
        "Discipline": "Disciplina",
        "under investigation": "sob investigação",
        "Under investigation": "Sob investigação",
        "Under investigation for corruption.": "Sob investigação por corrupção.",
        "qualified": "três quintos",
        "The Proletarian Vanguard": "A Vanguarda Proletária",
        "The Party Apparatus": "O Aparato do Partido",
        "Red Command": "O Comando Vermelho",
        "Military Campaign against a Planet": "Campanha militar contra um planeta",
        "New Fleet Quota": "Cota de nova frota",
        "Armoured Detachment": "Destacamento blindado",
        "Five-Year Plan: Raise the Quota": "Plano de cinco anos: elevar a cota",
        "Fraternal Pact": "Pacto fraterno",
        "Reassign and Dismantle a Fleet": "Reatribuir e desmontar uma frota",
        "Authorise an attack on one planet. Without it Combine fleets cannot attack.":
            "Autoriza um ataque a um planeta. Sem isso, as frotas do Combine não podem atacar.",
        "Approve one new fleet (build it from the galaxy map afterwards; it is still paid for there).":
            "Aprova uma nova frota (construa-a depois no mapa galáctico; ela continua sendo paga lá).",
        "Approve one elite armoured detachment (the Knightmare Facility chain is still needed).":
            "Aprova um destacamento blindado de elite (a cadeia da Instalação Knightmare ainda é necessária).",
        "Raise the production quota: 300-500 credits every 15 minutes per level (max 2), confidence -5.":
            "Eleva a cota de produção: 300-500 créditos a cada 15 minutos por nível (máximo 2), confiança -5.",
        "Send envoys to another faction: relations +10.":
            "Envia emissários a outra facção: relações +10.",
        "Break up one Combine fleet for 500 credits of salvage.":
            "Desmonta uma frota do Combine em troca de 500 créditos de sucata.",
        "The Soviet sits only while a Combine player is online. Its commissars bring directives of their own every few minutes.":
            "O Soviete só funciona enquanto um jogador do Combine estiver online. Seus comissários trazem diretivas próprias a cada poucos minutos.",
        "The Soviet has no directives before it yet. Bring one in NEW DIRECTIVE, or wait for the commissars.":
            "O Soviete ainda não tem diretivas. Leve uma em NOVA DIRETIVA ou aguarde os comissários.",
        "SELECTED FOR PRIVILEGES": "SELECIONADA PARA PRIVILÉGIOS",
        "SELECT TO GRANT PRIVILEGES": "SELECIONAR PARA CONCEDER PRIVILÉGIOS",
        "Your privileges:": "Seus privilégios:",
        "the plenum is still moving": "o plenário ainda se mexe",
        "yes votes (chance of a YES per current, before privileges and surprises).":
            "votos sim (chance de SIM por corrente, antes de privilégios e surpresas).",
        "PRIVILEGED": "PRIVILEGIADO",
        "privileges taken:": "privilégios aceitos:",
        "Click a commissar to see who they are. While a directive is debated you can grant them cadre privileges.":
            "Clique em um comissário para ver quem ele é. Enquanto uma diretiva está em debate, você pode conceder privilégios de quadro a ele.",
        "PRIVILEGES FOR:": "PRIVILÉGIOS PARA:",
        "Already granted:": "Já concedido:",
        "privileges for a YES": "privilégios por um SIM",
        "privileges for a NO": "privilégios por um NÃO",
        "GRANT": "CONCEDER",
        "Chance the privileges change the vote:": "Chance de os privilégios mudarem o voto:",
        "A grant that fails is still spent.": "Uma concessão que falha é gasta de qualquer forma.",
        "Cadre privileges can be granted once the debate opens.":
            "Privilégios de quadro podem ser concedidos quando o debate abrir.",
        "This directive is no longer open.": "Esta diretiva não está mais aberta.",
        "Select a directive in debate (DIRECTIVES tab) to grant this commissar cadre privileges.":
            "Selecione uma diretiva em debate (aba DIRETIVAS) para conceder privilégios a este comissário.",
        "Privileges granted:": "Privilégios concedidos:",
        "credits in total on this commissar.": "créditos no total para este comissário.",
        "High Commissar of the Combine": "Alto Comissário do Combine",
        "Election of the High Commissar": "Eleição do Alto Comissário",
        "elected by the players of the Combine, for a two week term":
            "eleito pelos jogadores do Combine, para um mandato de duas semanas",
        "The High Commissar may keep 5 directives before the Soviet (others 3), has used the veto of this term, and the ruling current's agenda is heard more often.":
            "O Alto Comissário pode manter 5 diretivas no Soviete (os outros 3), já usou o veto deste mandato e a agenda da corrente no poder é ouvida com mais frequência.",
        "The High Commissar may keep 5 directives before the Soviet (others 3), may veto one directive per term, and the ruling current's agenda is heard more often.":
            "O Alto Comissário pode manter 5 diretivas no Soviete (os outros 3), pode vetar uma diretiva por mandato e a agenda da corrente no poder é ouvida com mais frequência.",
        "The next election starts when the term ends (in": "A próxima eleição começa quando o mandato terminar (em",
        "An election is called as soon as a Combine player is online.":
            "Uma eleição é convocada assim que um jogador do Combine estiver online.",
        "STAND FOR HIGH COMMISSAR": "CANDIDATAR-SE A ALTO COMISSÁRIO",
        "Current chosen.": "Corrente escolhida.",
        "You are a candidate for High Commissar.": "Você é candidato a Alto Comissário.",
        "WHAT SHOULD THE SOVIET DECIDE?": "O QUE O SOVIETE DEVE DECIDIR?",
        "PLANET TO ATTACK": "PLANETA A ATACAR",
        "campaign approved": "campanha aprovada",
        "FLEET TO DISMANTLE": "FROTA A DESMONTAR",
        "WHICH CURRENT SPEAKS FOR IT?": "QUAL CORRENTE APRESENTA A DIRETIVA?",
        "Commissars of the sponsoring current vote for it far more often; currents near it tend to follow, distant ones oppose.":
            "Os comissários da corrente proponente votam a favor com muito mais frequência; correntes próximas tendem a acompanhar, as distantes se opõem.",
        "Introduction 3 minutes, then 5 minutes of debate (privileges are possible), then the vote. A commander may have 3 directives before the Soviet at once.":
            "Apresentação de 3 minutos, depois 5 minutos de debate (privilégios são possíveis) e então a votação. Um comandante pode ter 3 diretivas no Soviete ao mesmo tempo.",
        "PUT BEFORE THE SOVIET": "LEVAR AO SOVIETE",
        "Your directive is before the Soviet.": "Sua diretiva está no Soviete.",

        /* ---------- the Soviet: occupied worlds ---------- */
        "SOVIET POWER": "PODER SOVIÉTICO",
        "WORLDS HELD": "MUNDOS TOMADOS",
        "WHOLE WORLDS": "MUNDOS INTEIROS",
        "CITIES HELD": "CIDADES EM MÃOS",
        "Every world where the Combine holds at least one city. A world held whole comes under Soviet administration and moves through four stages — occupied, military administration, collectivised, incorporated — five turns of five minutes each, counted only while its stability is at least the threshold of the stage. Only a whole world pays into the plan; the rest still has to be taken, and a campaign needs the Soviet's approval.":
            "Todo mundo onde o Combine tem pelo menos uma cidade. Um mundo tomado por inteiro entra na administração soviética e passa por quatro estágios — ocupado, administração militar, coletivizado, incorporado — cinco turnos de cinco minutos cada, contados só enquanto a estabilidade for pelo menos o limite do estágio. Só um mundo inteiro paga ao plano; o resto ainda precisa ser tomado, e uma campanha precisa da aprovação do Soviete.",
        "MILITARY ADMIN": "ADMINISTRAÇÃO MILITAR",
        "COLLECTIVISED": "COLETIVIZADO",
        "INCORPORATED INTO THE UNION": "INCORPORADO À UNIÃO",
        "INCORPORATED": "INCORPORADOS",
        "military administration": "administração militar",
        "collectivised": "coletivizado",
        "incorporated into the Union": "incorporado à União",
        "dashed = contested, not yet a whole world": "tracejado = disputado, ainda não é um mundo inteiro",
        "hover a world for its stability, its cities and its fleets": "passe o rato num mundo para ver estabilidade, cidades e frotas",
        "1/4 is the stage of a world's administration, not the cities it has":
            "1/4 é a etapa da administração do mundo, não as cidades que ele tem",
        "Stability is enough: the administration advances one turn every five minutes.":
            "A estabilidade basta: a administração avança um turno a cada cinco minutos.",
        "Stability is below the threshold: the administration does not advance until relief is sent.":
            "A estabilidade está abaixo do limite: a administração não avança enquanto não for enviada ajuda.",
        "Fully integrated into the Union: the plan collects this world, the Party has its confidence and the world has sent the Soviet one more commissar.":
            "Totalmente integrado à União: o plano recolhe deste mundo, o Partido ganha confiança e o mundo enviou mais um comissário ao Soviete.",
        "GRANT RELIEF (+10 stability)": "CONCEDER AJUDA (+10 estabilidade)",
        "sent again in": "enviada de novo em",
        "Relief sent to": "Ajuda enviada a",
        "stability": "estabilidade",
        "Relief is sent straight to a world under Combine administration — no directive, no vote — for +10 stability, one world every five minutes. The Freedom Authority has to put the same relief before Congress first.":
            "A ajuda é enviada diretamente a um mundo sob administração do Combine — sem diretiva, sem votação — para +10 de estabilidade, um mundo a cada cinco minutos. A Autoridade da Liberdade tem de levar a mesma ajuda primeiro ao Congresso.",
        "The Combine holds no occupied world. When Combine fleets take every city of a planet, it comes under Soviet administration and moves through four stages — occupied, military administration, collectivised and finally incorporated into the Union. Each stage takes time and enough stability (relief is sent straight to the world), and every world incorporated sends the Soviet one more commissar from that planet.":
            "O Combine não tem nenhum mundo ocupado. Quando as frotas do Combine tomam todas as cidades de um planeta, ele entra na administração soviética e passa por quatro estágios — ocupado, administração militar, coletivizado e por fim incorporado à União. Cada estágio leva tempo e exige estabilidade suficiente (a ajuda é enviada diretamente ao mundo), e cada mundo incorporado envia ao Soviete mais um comissário daquele planeta.",
        "WHOLE": "INTEIRO",
        "CONTESTED": "DISPUTADO",
        "cities held": "cidades em mãos",
        "also held by": "também em mãos de",
        "PRODUCTION": "PRODUÇÃO",
        "into the plan every 5 minutes": "para o plano a cada 5 minutos",
        "Incorporated into the Union: the plan collects this world.":
            "Incorporado à União: o plano recolhe deste mundo.",
        "Campaign approved: the fleets may attack it.": "Campanha aprovada: as frotas podem atacá-lo.",
        "A campaign against it is before the Soviet.": "Há uma campanha contra ele no Soviete.",
        "PUT A CAMPAIGN BEFORE THE SOVIET": "LEVAR UMA CAMPANHA AO SOVIETE",
        "WAR": "GUERRA",
        "SOVIET": "SOVIETE",
        "your target": "seu alvo",
        "click a planet to put a campaign against it before the Soviet":
            "clique num planeta para levar uma campanha contra ele ao Soviete",
        "before the Soviet": "no Soviete",
        "contested world": "mundo disputado",
        "whole world": "mundo inteiro",
        "dim = not ours yet": "apagado = ainda não é nosso",
        "hover a world for its cities and its fleets": "passe o rato num mundo para ver suas cidades e suas frotas",

        /* ---------- the Soviet: agitprop ---------- */
        "Agitprop is paid from the Combine treasury. A campaign raises the discipline of a current's commissars and can pull the least disciplined commissars of the other currents over to it. The same current can be targeted once every ten minutes.":
            "O agitprop é pago pelo tesouro do Combine. Uma campanha sobe a disciplina dos comissários de uma corrente e pode puxar para ela os comissários menos disciplinados das outras correntes. A mesma corrente só pode ser alvo uma vez a cada dez minutos.",
        "The agitprop offices are not installed": "Os escritórios de agitprop não estão instalados",
        "Run sql/2026-10-30_soviet_agitprop.sql in the Supabase SQL editor, then reload this page.":
            "Execute sql/2026-10-30_soviet_agitprop.sql no editor SQL do Supabase e recarregue esta página.",
        "Loading the agitprop offices...": "Carregando os escritórios de agitprop...",
        "The agitprop offices": "Os escritórios de agitprop",
        "A campaign lifts the discipline of the current's own commissars and wins over the least disciplined commissars of the others (they join it, at its level of discipline). More money means more points and more commissars.":
            "Uma campanha sobe a disciplina dos próprios comissários da corrente e conquista os comissários menos disciplinados das outras (eles se juntam a ela, no nível de disciplina dela). Mais dinheiro significa mais pontos e mais comissários.",
        "A campaign for this current is still running:": "Ainda há uma campanha para esta corrente em curso:",
        "Agitprop campaign:": "Campanha de agitprop:",
        "commissar changed current": "comissário mudou de corrente",
        "commissars changed current": "comissários mudaram de corrente",
        "a YES raises the maximum to": "um SIM eleva o máximo para",
        "Our fleets here:": "Nossas frotas aqui:",
        "No fleet of ours here.": "Nenhuma frota nossa aqui.",
        "squads": "esquadrões",
        "Every world is already ours.": "Todo mundo já é nosso.",
        "Contested": "Disputado",
        "Unclaimed": "Não reclamado",
        "none": "nenhuma",

        /* ---------- the Soviet: what it has authorised ---------- */
        "FLEETS IN SERVICE": "FROTAS EM SERVIÇO",
        "of the maximum the Soviet permits": "do máximo que o Soviete permite",
        "QUOTAS WAITING": "COTAS EM ESPERA",
        "one fleet each": "uma frota cada",
        "ARMOURED DETACHMENTS": "DESTACAMENTOS BLINDADOS",
        "APPROVED CAMPAIGNS": "CAMPANHAS APROVADAS",
        "APPROVED": "APROVADA",
        "BEFORE THE SOVIET": "NO SOVIETE",
        "PROPOSE": "PROPOR",
        "The fleet quota": "A cota de frotas",
        "The Soviet permits": "O Soviete permite",
        "fleets:": "frotas:",
        "in service and": "em serviço e",
        "quota(s) not yet spent": "cota(s) ainda não gasta(s)",
        "Every approved quota directive raises the maximum by one; building a fleet spends the quota instead of raising it.":
            "Cada diretiva de cota aprovada eleva o máximo em uma frota; construir uma frota gasta a cota em vez de elevar o máximo.",
        "The next fleet costs": "A próxima frota custa",
        "credits, paid when it is built and not when the directive passes.":
            "créditos, pagos quando ela é construída e não quando a diretiva passa.",
        "A QUOTA IS ALREADY BEFORE THE SOVIET": "JÁ HÁ UMA COTA NO SOVIETE",
        "PUT A FLEET QUOTA BEFORE THE SOVIET": "LEVAR UMA COTA DE FROTA AO SOVIETE",
        "War room: a campaign against a world": "Sala de guerra: uma campanha contra um mundo",
        "Only players bring a campaign; the commissars never declare one. A majority is enough. Without an approved campaign Combine fleets cannot attack the planet.":
            "Só jogadores trazem uma campanha; os comissários nunca declaram uma. A maioria simples basta. Sem campanha aprovada, as frotas do Combine não podem atacar o planeta.",
        "(it shifts every vote by up to ±10 points: a confident Party gets its way more often)":
            "(ela desloca cada votação em até ±10 pontos: um Partido confiante impõe sua vontade com mais frequência)",
        "PRODUCTION PLAN": "PLANO DE PRODUÇÃO",
        "300-500 credits every 15 minutes per level": "300-500 créditos a cada 15 minutos por nível",
        "The three currents": "As três correntes",
        "FLEETS NOW:": "FROTAS AGORA:",
        "(in service / the maximum the Soviet permits). This directive raises the maximum to":
            "(em serviço / o máximo que o Soviete permite). Esta diretiva eleva o máximo para",
        "Raise the maximum by one fleet (build it from the galaxy map afterwards; it is still paid for there).":
            "Eleva o máximo em uma frota (construa-a depois no mapa galáctico; ela ainda é paga lá).",
        "in service / the maximum the Soviet permits": "em serviço / o máximo que o Soviete permite",
        "quota(s) waiting": "cota(s) em espera",

        /* ---------- the fleet menu on a planet ---------- */
        "SOVIET FLEET QUOTA": "COTA DE FROTAS DO SOVIETE",
        "NEXT FLEET": "PRÓXIMA FROTA",
        "CREDITS": "CRÉDITOS",
        "fleets": "frotas",
        "put a new fleet quota before it first": "coloque antes uma nova cota de frota no Soviete",
        "the quota waiting belongs to another commander": "a cota em espera pertence a outro comandante",
        "none of the quotas waiting is yours": "nenhuma das cotas em espera é sua",

        /* ---------- host tools / overlays ---------- */
        "THE GAME HAS NOT STARTED": "O JOGO NÃO COMEÇOU",
        "Everything is frozen. Waiting for the host to begin the war.":
            "Tudo está congelado. Aguardando o anfitrião iniciar a guerra.",
        "You are the host. Everything stays frozen until you press START.":
            "Você é o anfitrião. Tudo permanece congelado até você pressionar INICIAR.",
        "START THE GAME": "INICIAR O JOGO",
        "Starting...": "Iniciando...",
        "UNDER MAINTENANCE": "EM MANUTENÇÃO",
        "The game is temporarily closed. Everything is saved and frozen exactly as you left it: nothing moves, nothing is lost. It reopens when the host says so.":
            "O jogo está temporariamente fechado. Tudo fica salvo e congelado exatamente como você deixou: nada se move, nada se perde. Ele reabre quando o anfitrião decidir.",
        "CLOSE THE GAME (MAINTENANCE)": "FECHAR O JOGO (MANUTENÇÃO)",
        "MAINTENANCE IS ON - OPEN THE GAME": "MANUTENÇÃO ATIVA - ABRIR O JOGO",
        "RESET GAME": "REINICIAR JOGO",
        "Host only: puts the whole game back to the start":
            "Somente o anfitrião: devolve o jogo inteiro ao início",
        "Could not change maintenance mode:": "Não foi possível alterar o modo de manutenção:",
        "OPEN THE GAME again? Every timer continues from where it stopped.":
            "ABRIR O JOGO novamente? Todos os cronômetros continuam de onde pararam.",
        "CLOSE THE GAME for every player?": "FECHAR O JOGO para todos os jogadores?",
        "They will see a maintenance screen. Everything is saved and frozen, and nothing is lost.":
            "Eles verão uma tela de manutenção. Tudo fica salvo e congelado, e nada se perde.",
        "Finish or announce any live battles first.": "Termine ou avise sobre batalhas ao vivo primeiro.",
        "Optional message for the players (or leave empty):":
            "Mensagem opcional para os jogadores (ou deixe vazio):",
        "This puts the ENTIRE game back to the start:": "Isso devolve o JOGO INTEIRO ao início:",
        "- all fleets, buildings and garrison levels are wiped":
            "- todas as frotas, construções e níveis de guarnição são apagados",
        "- every faction's credits go back to 500": "- os créditos de todas as facções voltam a 500",
        "- Combine and Freedom Authority keep only their capital":
            "- Combine e Freedom Authority mantêm apenas sua capital",
        "- the civil wars on Krieg and Vraks restart": "- as guerras civis em Krieg e Vraks recomeçam",
        "Type RESET to confirm.": "Digite RESET para confirmar.",
        "Reset failed:": "Falha ao reiniciar:",
        "The reset finished, but some parts could not be done:":
            "A reinicialização terminou, mas algumas partes não puderam ser feitas:",

        /* ---------- the elected leaders and the parties (2026-10-31) ---------- */
        "CONGRESS LEADER": "LÍDER DO CONGRESSO",
        "Congress Leader": "Líder do Congresso",
        "Election of the Congress Leader": "Eleição do Líder do Congresso",
        "elected by the players, for a two week term": "eleito pelos jogadores, para um mandato de duas semanas",
        "PARTY": "PARTIDO",
        "DIPLOMACY": "DIPLOMACIA",
        "Every Freedom Authority player belongs to a party, and a party is joined here at any time - not only when an election is called. You need one to stand for President of the Freedom Authority, or to vote in its election.":
            "Todo jogador da Freedom Authority pertence a um partido, e o partido é escolhido aqui a qualquer momento - não apenas quando uma eleição é convocada. Você precisa de um para se candidatar a Presidente da Freedom Authority, ou para votar nessa eleição.",
        "You sit with": "Você senta com",
        "Click another party to cross the floor.": "Clique em outro partido para mudar de lado.",
        "You belong to no party yet: choose one above.": "Você ainda não tem partido: escolha um acima.",
        "Your current of the Party": "Sua corrente do Partido",
        "Every Combine player belongs to one of the Party's three currents, and a current is joined here at any time - not only when an election is called. You need one to stand for High Commissar or to vote.":
            "Todo jogador do Combine pertence a uma das três correntes do Partido, e a corrente é escolhida aqui a qualquer momento - não apenas quando uma eleição é convocada. Você precisa de uma para se candidatar a Alto Comissário ou votar.",
        "Click another current to cross the floor.": "Clique em outra corrente para mudar de lado.",
        "You belong to no current yet: choose one above.": "Você ainda não tem corrente: escolha uma acima.",
        "Join a current in the PARTY tab first.": "Entre em uma corrente na aba PARTIDO primeiro.",
        "Join a current in the PARTY tab to vote.": "Entre em uma corrente na aba PARTIDO para votar.",

        /* ---------- diplomacy with the independent worlds (2026-10-31) ---------- */
        "THE TWO MAIN FACTIONS": "AS DUAS FACÇÕES PRINCIPAIS",
        "the Combine thinks of us": "o Combine pensa de nós",
        "we think of the Combine": "pensamos do Combine",
        "the Freedom Authority thinks of us": "a Freedom Authority pensa de nós",
        "we think of the Freedom Authority": "pensamos da Freedom Authority",
        "TRADING TRUCE: both sides hold the other at 50 or better, so every income payment of both treasuries is ten percent bigger.":
            "TRÉGUA COMERCIAL: os dois lados se enxergam com 50 ou mais, então cada pagamento de renda dos dois tesouros é dez por cento maior.",
        "No truce. Both sides must hold the other at 50 or better, and a diplomatic mission raises the reading by 10.":
            "Sem trégua. Os dois lados precisam se enxergar com 50 ou mais, e uma missão diplomática eleva a leitura em 10.",
        "No truce. Both sides must hold the other at 50 or better, and a fraternal pact raises the reading by 10.":
            "Sem trégua. Os dois lados precisam se enxergar com 50 ou mais, e um pacto fraterno eleva a leitura em 10.",
        "A bill in the NEW PROPOSAL tab sends envoys to the other faction.":
            "Uma proposta na aba NOVA PROPOSTA envia emissários à outra facção.",
        "A directive in the NEW DIRECTIVE tab sends envoys to the other faction.":
            "Uma diretiva na aba NOVA DIRETIVA envia emissários à outra facção.",
        "INDEPENDENT WORLDS": "MUNDOS INDEPENDENTES",
        "The Independents are not a faction any more: every independent world is its own partner. Send envoys until the reading reaches 100 and the world signs the pact and joins the Freedom Authority without a single shot.":
            "Os Independents não são mais uma facção: cada mundo independente é um parceiro próprio. Envie emissários até a leitura chegar a 100 e o mundo assinar o pacto e entrar na Freedom Authority sem um único tiro.",
        "The Independents are not a faction any more: every independent world is its own partner. Send envoys until the reading reaches 100 and the world signs the pact and joins the Union without a single shot.":
            "Os Independents não são mais uma facção: cada mundo independente é um parceiro próprio. Envie emissários até a leitura chegar a 100 e o mundo assinar o pacto e entrar na União sem um único tiro.",
        "Treasury:": "Tesouro:",
        "an embassy costs": "uma embaixada custa",
        "one send per world every five minutes": "um envio por mundo a cada cinco minutos",
        "the Combine is at": "o Combine está em",
        "the Freedom Authority is at": "a Freedom Authority está em",
        "relations": "relações",
        "envoys sent": "emissários enviados",
        "the world signs the pact at 100": "o mundo assina o pacto aos 100",
        "the court will see you again in": "a corte receberá você novamente em",
        "SEND ENVOYS": "ENVIAR EMISSÁRIOS",
        "No independent world is left: every one of them answers to somebody now.":
            "Não resta nenhum mundo independente: todos eles respondem a alguém agora.",
        "The embassies arrive with sql/2026-10-31_leaders_parties_and_diplomacy.sql. Run it, then reload this page.":
            "As embaixadas chegam com sql/2026-10-31_leaders_parties_and_diplomacy.sql. Execute-o e recarregue esta página.",
        "The independents are not a bloc any more: their worlds are dealt with one by one in the DIPLOMACY tab of the galactic map.":
            "Os independentes não são mais um bloco: seus mundos são tratados um a um na aba DIPLOMACIA do mapa galáctico.",

        /* ---------- the DIPLOMACY tab of the galactic map (2026-11-02) ---------- */
        "BACK TO THE MAP": "VOLTAR AO MAPA",
        "THE OTHER FACTION": "A OUTRA FACÇÃO",
        "The ceasefire arrives with sql/2026-11-02_temporary_ceasefire.sql. Run it, then reload this page.":
            "O cessar-fogo chega com sql/2026-11-02_temporary_ceasefire.sql. Rode o arquivo e recarregue esta página.",
        "The Freedom Authority and the Combine can agree on one thing only: a stretch of quiet. A ceasefire freezes every assault, weapons shipment and reinforcement on both sides, at most an hour, and it ends by itself. Nothing is signed away and the war always comes back.":
            "A Freedom Authority e o Combine só conseguem concordar numa coisa: um período de silêncio. Um cessar-fogo congela todo assalto, envio de armas e reforço dos dois lados, no máximo por uma hora, e termina sozinho. Nada é assinado em definitivo e a guerra sempre volta.",
        "CEASEFIRE IN FORCE": "CESSAR-FOGO EM VIGOR",
        "offered by": "proposto por",
        "signed by": "assinado por",
        "The front is frozen: no assault, no weapons, no reinforcements, on either side, until the clock runs out.":
            "O fronte está congelado: nenhum assalto, nenhuma arma, nenhum reforço, de nenhum dos lados, até o relógio chegar a zero.",
        "YOUR CEASEFIRE IS ON THE TABLE": "SEU CESSAR-FOGO ESTÁ NA MESA",
        "THE OTHER SIDE OFFERS A CEASEFIRE": "O OUTRO LADO PROPÕE UM CESSAR-FOGO",
        "MINUTES": "MINUTOS",
        "Waiting for the other side to answer.": "Esperando a resposta do outro lado.",
        "Your answer, before the offer lapses:": "Sua resposta, antes que a oferta caduque:",
        "An offer lapses ten minutes after it is made. The other side has to sign it.":
            "Uma oferta caduca dez minutos depois de feita. O outro lado precisa assiná-la.",
        "ACCEPT THE CEASEFIRE": "ACEITAR O CESSAR-FOGO",
        "REFUSE": "RECUSAR",
        "NO CEASEFIRE": "SEM CESSAR-FOGO",
        "Offer the other side a stretch of quiet. It cannot last longer than an hour, and the other side has to sign it.":
            "Ofereça ao outro lado um período de silêncio. Não dura mais que uma hora, e o outro lado precisa assinar.",
        "THE BOOK": "O LIVRO",
        "SIGNED": "ASSINADO",
        "REFUSED": "RECUSADO",
        "LAPSED": "CADUCADO",
        "ON THE TABLE": "NA MESA",
        "signed the pact.": "assinou o pacto.",
        "The embassies arrive with sql/2026-10-31_leaders_parties_and_diplomacy.sql. Run it, then reload this page.":
            "As embaixadas chegam com sql/2026-10-31_leaders_parties_and_diplomacy.sql. Rode o arquivo e recarregue esta página.",

        /* ---------- the stages, the dirty tricks and the supply lines (2026-11-03) ---------- */
        "NEUTRAL": "NEUTRO",
        "FRIENDLY": "AMIGÁVEL",
        "ALLIED": "ALIADO",
        "SATELLITE": "SATÉLITE",
        "INTEGRATED": "INTEGRADO",
        "the other side is at": "o outro lado está em",
        "next stage at": "próximo nível em",
        "it leans to your side": "inclina-se para o seu lado",
        "it leans to the other side": "inclina-se para o outro lado",
        "it leans nowhere yet": "ainda não se inclina para ninguém",
        "The Independents are not a faction any more: every independent world is its own partner. Envoys raise its standing with you, stage by stage — friendly at 25, allied at 50, a satellite at 75 — until at 100 it is integrated and joins the Union. Or you can lean on it: arm its rebels, or throw its government out.":
            "Os Independentes não são mais uma facção: cada mundo independente é um parceiro próprio. Os emissários elevam sua posição com você, nível a nível — amigável aos 25, aliado aos 50, satélite aos 75 — até que aos 100 ele seja integrado e entre na União. Ou você pode pressioná-lo: armar seus rebeldes, ou derrubar seu governo.",
        "The Independents are not a faction any more: every independent world is its own partner. Envoys raise its standing with you, stage by stage — friendly at 25, allied at 50, a satellite at 75 — until at 100 it is integrated and joins the Freedom Authority. Or you can lean on it: arm its rebels, or throw its government out.":
            "Os Independentes não são mais uma facção: cada mundo independente é um parceiro próprio. Os emissários elevam sua posição com você, nível a nível — amigável aos 25, aliado aos 50, satélite aos 75 — até que aos 100 ele seja integrado e entre na Freedom Authority. Ou você pode pressioná-lo: armar seus rebeldes, ou derrubar seu governo.",
        "ARM THE REBELS": "ARMAR OS REBELDES",
        "OVERTHROW THE GOVERNMENT": "DERRUBAR O GOVERNO",
        "both can fail, and a failed coup hands the world to the other side":
            "os dois podem falhar, e um golpe fracassado entrega o mundo ao outro lado",
        "The government will not receive you for": "O governo não receberá você por mais",
        "the rebels are armed": "os rebeldes estão armados",
        "the arms were intercepted": "as armas foram interceptadas",
        "yours": "seu",
        "theirs": "deles",
        "the government has fallen: the world is integrated": "o governo caiu: o mundo está integrado",
        "the coup failed: the world swings to the other side": "o golpe falhou: o mundo passa para o outro lado",
        "Throw the government of ": "Derrubar o governo de ",
        " out? If it fails, the world swings to the other side.": "? Se falhar, o mundo passa para o outro lado.",

        "SUPPLY LINES": "LINHAS DE ABASTECIMENTO",
        "THE LINES": "AS LINHAS",
        "CAPITAL": "CAPITAL",
        "NO LINE": "SEM LINHA",
        "OPEN": "ABERTA",
        "CUT": "CORTADA",
        "CLOSE THE LINE": "FECHAR A LINHA",
        "OPEN A LINE": "ABRIR UMA LINHA",
        "income": "receita",
        "per payment": "por pagamento",
        "carrying": "a transportar",
        "a line costs": "uma linha custa",
        "the corridor is": "o corredor tem",
        "wide": "de largura",
        "Delivering:": "Entregando:",
        "lines cut:": "linhas cortadas:",
        "You hold no world whole yet.": "Você ainda não controla nenhum mundo por inteiro.",
        "Credits only reach the capital along a supply line. Open one from a world you hold whole, and it carries its income to ":
            "Os créditos só chegam à capital por uma linha de abastecimento. Abra uma a partir de um mundo que você controla por inteiro, e ela leva a receita até ",
        "An enemy fleet in orbit of the world, in orbit of the capital, or anywhere across the corridor between them cuts the line until it moves on.":
            "Uma frota inimiga em órbita do mundo, em órbita da capital, ou em qualquer ponto do corredor entre eles corta a linha até ela se mover.",
        "in orbit of the world": "em órbita do mundo",
        "in orbit of the capital": "em órbita da capital",
        "across the corridor": "atravessando o corredor",
        "line open to": "linha aberta até",
        "line closed.": "linha fechada.",
        "The supply lines arrive with sql/2026-11-03_diplomacy_levels_supply_and_fog.sql. Run it, then reload this page.":
            "As linhas de abastecimento chegam com sql/2026-11-03_diplomacy_levels_supply_and_fog.sql. Rode o arquivo e recarregue esta página.",
        "SUPPLIED": "ABASTECIDO",
        "CUT UPSTREAM": "CORTADA A MONTANTE",
        "feeds through": "abastece-se via",
        "it feeds nobody": "não abastece ninguém",
        "THE NETWORK": "A REDE",
        "worlds cut:": "mundos cortados:",
        "in orbit of the world it feeds through": "em órbita do mundo por onde se abastece",
        "The network runs itself: every world you hold whole feeds the nearest world you hold whole that is closer to the capital, so the lines run inward, world by world. Nothing is bought and nothing is clicked.":
            "A rede funciona sozinha: cada mundo que você controla por inteiro abastece o mundo mais próximo que você também controla por inteiro e que esteja mais perto da capital, então as linhas correm para dentro, mundo a mundo. Nada é comprado e nada é clicado.",
        "An enemy fleet in orbit of either end of a link, or anywhere across the corridor between them, cuts it — and every world behind it goes with it, until the enemy moves on.":
            "Uma frota inimiga em órbita de qualquer das pontas de um trecho, ou em qualquer ponto do corredor entre elas, corta o trecho — e todo mundo atrás dele cai junto, até o inimigo se mover.",
        "The supply network arrives with sql/2026-11-04_automatic_supply_network.sql. Run it, then reload this page.":
            "A rede de abastecimento chega com sql/2026-11-04_automatic_supply_network.sql. Rode o arquivo e recarregue esta página.",
        "ACTIVE FLEETS": "FROTAS ATIVAS",
        "ENEMY IN SENSOR RANGE": "INIMIGO NO ALCANCE DOS SENSORES",
        "ENEMIES IN SENSOR RANGE": "INIMIGOS NO ALCANCE DOS SENSORES",
        "NO ENEMY IN SENSOR RANGE": "NENHUM INIMIGO NO ALCANCE DOS SENSORES",

        /* ---------- the fog of war (2026-11-05) ---------- */
        "ENEMY IN SIGHT": "INIMIGO À VISTA",
        "ENEMIES IN SIGHT": "INIMIGOS À VISTA",
        "NO ENEMY IN SIGHT": "NENHUM INIMIGO À VISTA",
        "LAST SEEN": "VISTO POR ÚLTIMO",
        "LAST SEEN CONTACT": "CONTACTO VISTO POR ÚLTIMO",
        "LAST SEEN CONTACTS": "CONTACTOS VISTOS POR ÚLTIMO",
        "NO LOST CONTACTS": "SEM CONTACTOS PERDIDOS",
        "SUPPLY LINK CUT": "LIGAÇÃO DE ABASTECIMENTO CORTADA",
        "SUPPLY LINKS CUT": "LIGAÇÕES DE ABASTECIMENTO CORTADAS",

        /* ---------- the economy reading and the menu note (2026-10-31) ---------- */
        "IDLE: NOBODY HAS TOUCHED THE GAME, SO THE INCOME IS HALVED":
            "OCIOSO: NINGUÉM TOCOU NO JOGO, ENTÃO A RENDA É PELA METADE",
        "NOBODY HAS PLAYED FOR TWO HOURS: THE INCOME IS OFF FOR EVERY SIDE UNTIL SOMEBODY PLAYS":
            "NINGUÉM JOGA HÁ DUAS HORAS: A RENDA ESTÁ DESLIGADA PARA TODOS OS LADOS ATÉ ALGUÉM JOGAR",
        "INDEPENDENT WORLDS ARE UNALIGNED: they are not a faction you can play, and each one is negotiated with on its own.":
            "MUNDOS INDEPENDENTES NÃO TÊM ALINHAMENTO: não são uma facção jogável, e cada um é negociado individualmente.",
        "- the Soviet's directives, parties and its High Commissar are cleared":
            "- as diretivas do Soviete, seus partidos e seu Alto Comissário são apagados",
        "- every embassy, the truce and the list of who is playing are cleared":
            "- todas as embaixadas, a trégua e a lista de quem está jogando são apagadas",

        /* ---------- the dock, the neutral orbits and unrest (2026-11-06) ---------- */
        "BATTLE IN THE ORBIT OF": "BATALHA NA ÓRBITA DE",
        "FLEET DAMAGED": "FROTA DANIFICADA",
        "FLEETS DAMAGED": "FROTAS DANIFICADAS",
        "Two rival fleets met over a world that belongs to nobody.":
            "Duas frotas rivais encontraram-se sobre um mundo que não pertence a ninguém.",
        "HULL:": "CASCO:",
        "soldiers missing": "soldados em falta",
        "at full strength": "em força total",
        "REPAIR FLEET": "REPARAR FROTA",
        "AT FULL STRENGTH": "EM FORÇA TOTAL",
        "CREDITS": "CRÉDITOS",
        "Dock:": "Estaleiro:",
        "soldiers restored for": "soldados repostos por",
        "credits": "créditos",
        "Treasury": "Tesouro",
        "UNREST": "AGITAÇÃO",
        "revolts": "revoltas",
        "CALM": "CALMA",
        "RESTLESS": "INQUIETA",
        "RIOTING": "EM MOTIM",
        "REVOLT": "REVOLTA",
        /* ---------- how a world is administered (2026-11-13) ---------- */
        "POLICY": "POLÍTICA",
        "CIVIL RULE": "ADMINISTRAÇÃO CIVIL",
        "REPRISALS": "REPRESÁLIAS",
        "AMNESTY": "AMNISTIA",
        "GARRISON": "GUARNIÇÃO",
        "NO GARRISON": "SEM GUARNIÇÃO",
        "How a world we hold whole is administered. Civil rule pays what the world always paid; reprisals pay half again its income and make its people angrier; amnesty pays half and lets them settle.":
            "Como é administrado um mundo que dominamos por inteiro. A administração civil paga o que o mundo sempre pagou; as represálias pagam mais metade da sua receita e enfurecem o seu povo; a amnistia paga metade e deixa-o acalmar.",
        "Unrest climbs two points a turn faster while no fleet of ours stands in this world's orbit.":
            "A agitação cresce dois pontos por turno mais depressa enquanto nenhuma frota nossa estiver na órbita deste mundo.",
        /* ---------- committees and ministers (2026-11-15) ---------- */
        "COMMITTEES": "COMISSÕES",
        "COMMITTEES AND MINISTERS": "COMISSÕES E MINISTROS",
        "THE COMMITTEES": "AS COMISSÕES",
        "THE MINISTRIES": "OS MINISTÉRIOS",
        "COMMITTEE OF FLEETS": "COMISSÃO DAS FROTAS",
        "COMMITTEE OF THE TREASURY": "COMISSÃO DO TESOURO",
        "COMMITTEE OF DIPLOMACY": "COMISSÃO DA DIPLOMACIA",
        "WAR": "GUERRA",
        "TREASURY": "TESOURO",
        "INTERIOR": "INTERIOR",
        "Chaired by": "Presidida por",
        "REPORT TO THE VOTE": "RELATAR À VOTAÇÃO",
        "reports in": "relata dentro de",
        "No bill of this committee's kind is before the chamber.": "Não há nenhuma proposta do género desta comissão perante a câmara.",
        "The chair may report one bill of the committee's own kind straight to the vote, once a term and ten minutes apart at the least. Nowhere else does a seat count for anything but a vote.":
            "A presidência pode relatar uma proposta do género da sua comissão directamente à votação, uma vez por mandato e com dez minutos de intervalo no mínimo. Em nenhum outro lugar uma cadeira vale mais do que um voto.",
        "No minister": "Sem ministro",
        "APPOINT": "NOMEAR",
        "DISMISS": "EXONERAR",
        "The President of the Freedom Authority names the ministers; the High Commissar of the Combine does the same in the Soviet. Each ministry may act once a term: the war ministry authorises one campaign without a bill, the treasury takes one extraordinary levy (300-500 credits, and the people are told), and the interior sends one load of relief (+10 stability).":
            "O Presidente da Freedom Authority nomeia os ministros; o Alto Comissário do Combine faz o mesmo no Soviete. Cada ministério pode agir uma vez por mandato: a guerra autoriza uma campanha sem proposta, o tesouro lança um imposto extraordinário (300-500 créditos, e o povo sabe quem o cobrou), e o interior envia um carregamento de alívio (+10 estabilidade).",
        "AUTHORISE CAMPAIGN": "AUTORIZAR CAMPANHA",
        "EXTRAORDINARY LEVY": "IMPOSTO EXTRAORDINÁRIO",
        "SEND RELIEF": "ENVIAR ALÍVIO",
        "Only the ministry's holder may act.": "Só o titular do ministério pode agir.",
        "STATE SECURITY": "SEGURANÇA DO ESTADO",
        "The President of the Freedom Authority names the ministers. While the office is empty, any Freedom Authority player may.":
            "O Presidente da Freedom Authority nomeia os ministros. Enquanto o cargo estiver vago, qualquer jogador da Freedom Authority pode fazê-lo.",
        "The High Commissar of the Combine names the commissars. While the office is empty, any Combine player may.":
            "O Alto Comissário do Combine nomeia os comissários. Enquanto o cargo estiver vago, qualquer jogador do Combine pode fazê-lo.",
        "The ministries are the chamber's, and no delegate holds two: the party with the most seats fills them with its most loyal delegates, and the President may name each holder himself. Each holder acts on his own once a term, more boldly when he is loyal and his party is in favour and less when it is not. A party below 25 loyalty is not served at all.":
            "Os ministérios são da câmara, e nenhum delegado fica com dois: o partido com mais cadeiras preenche-os com os seus delegados mais leais, e o Presidente pode nomear cada titular. Cada titular age por sua conta uma vez por mandato — com mais força quando é leal e o seu partido está em favor, com menos quando não está. Um partido abaixo de 25 de lealdade não é servido de todo.",
        "The commissariats are the plenum's, and no commissar holds two: the current with the most seats fills them with its most loyal commissars, and the High Commissar may name each holder himself. Each holder acts on his own once a term, harder when he is loyal and his current is in favour and less when it is not. A current below 25 loyalty is not served at all.":
            "Os comissariados são do plenário, e nenhum comissário fica com dois: a corrente com mais cadeiras preenche-os com os seus comissários mais leais, e o Alto Comissário pode nomear cada titular. Cada titular age por sua conta uma vez por mandato — com mais força quando é leal e a sua corrente está em favor, com menos quando não está. Uma corrente abaixo de 25 de lealdade não é servida de todo.",
        "The party book is missing a column. Run sql/2026-11-22_the_party_book_has_a_loyalty.sql, then reload this page.":
            "O livro dos partidos não tem uma coluna. Rode sql/2026-11-22_the_party_book_has_a_loyalty.sql e recarregue esta página.",
        "A table or column this screen needs is missing. Run sql/2026-11-15_committees_and_ministers.sql, then sql/2026-11-20_the_ministries_belong_to_the_chamber.sql, then sql/2026-11-22_the_party_book_has_a_loyalty.sql.":
            "Falta uma tabela ou coluna que este ecrã precisa. Rode sql/2026-11-15_committees_and_ministers.sql, depois sql/2026-11-20_the_ministries_belong_to_the_chamber.sql e depois sql/2026-11-22_the_party_book_has_a_loyalty.sql.",
        "GRAIN": "GRÃO",
        "LABOUR": "TRABALHO",
        "loyalty": "lealdade",
        "stability": "estabilidade",
        "That ministry has already acted this term.": "Esse ministério já agiu neste mandato.",
        "The ministries are held by the chamber, not named by hand: the party with the most seats gives each post to its most loyal delegate, and the holder acts on his own once a term, more boldly when he is loyal and his party is in favour and less when it is not. A party below 25 loyalty is not served at all.":
            "Os ministérios pertencem à câmara e não são nomeados à mão: o partido com mais cadeiras entrega cada pasta ao seu delegado mais leal, e o titular age por sua conta uma vez por mandato — com mais força quando é leal e o seu partido está em favor, com menos quando não está. Um partido abaixo de 25 de lealdade não é servido de todo.",
        "The commissariats are held by the plenum, not named by hand: the current with the most seats gives each post to its most loyal commissar, and the holder acts on his own once a term, harder when he is loyal and his current is in favour and less when it is not. A current below 25 loyalty is not served at all.":
            "Os comissariados pertencem ao plenário e não são nomeados à mão: a corrente com mais cadeiras entrega cada pasta ao seu comissário mais leal, e o titular age por sua conta uma vez por mandato — com mais força quando é leal e a sua corrente está em favor, com menos quando não está. Uma corrente abaixo de 25 de lealdade não é servida de todo.",
        "Run sql/2026-11-15_committees_and_ministers.sql, then reload this page.":
            "Rode sql/2026-11-15_committees_and_ministers.sql e recarregue esta página.",
        "A world": "Um mundo",
        "Has not acted this term.": "Ainda não agiu neste mandato.",
        "Authorised a fleet with no bill: build it from the galaxy map.":
            "Autorizou uma frota sem proposta: constrói-a no mapa galáctico.",
        "Took an extraordinary levy:": "Cobrou um imposto extraordinário:",
        "and the people were told.": "e o povo foi avisado.",
        "Sent relief to": "Enviou alívio para",
        "Nothing: the holder's party is in disgrace and will not serve this term.":
            "Nada: a bancada do titular está em desgraça e não serve neste mandato.",
        "Nothing: the holder is too sullen to act this term.":
            "Nada: o titular está demasiado ressentido para agir neste mandato.",
        "Nothing to do: every world we administer is already settled.":
            "Nada a fazer: todos os mundos que administramos já estão pacificados.",
        "Unrest climbs on a world that was taken by force. It eats the world's stability, and at a hundred the world rises and throws the occupation off.":
            "A agitação cresce num mundo tomado à força. Ela consome a estabilidade do mundo e, aos cem, o mundo levanta-se e expulsa a ocupação.",

        /* ---------- the army (2026-11-16) ---------- */
        "THE ARMY": "O EXÉRCITO",
        "REPAIR THE WHOLE ARMY": "REPARAR O EXÉRCITO INTEIRO",
        "under strength": "abaixo do efectivo",
        "Every fleet of yours that is in orbit goes to the dock at once: the treasury pays for all of it, or nothing is repaired.":
            "Cada frota tua que esteja em órbita vai de uma vez para a doca: o tesouro paga por todas, ou não se repara nenhuma.",

        /* ---------- the guide, the phone switch, and the holes (2026-11-17) ---------- */
        "An election will be called as soon as a Freedom Authority player is online.": "Uma eleição é convocada assim que houver um jogador da Freedom Authority em linha.",
        "LOYALTY": "LEALDADE",
        "soldiers": "soldados",
        "The chamber elects its own president with sql/2026-11-06_orbits_repairs_unrest_and_offices.sql. Run it, then reload this page.": "A câmara elege o seu próprio presidente com sql/2026-11-06_orbits_repairs_unrest_and_offices.sql. Rode-o e recarregue esta página.",
        "This commissar has not voted yet.": "Este comissário ainda não votou.",
        "GUIDE": "GUIA",
        "Eight steps through the Congress. Each one opens the tab it is about; come back here for the next.": "Oito passos pelo Congresso. Cada um abre o separador de que trata; volta aqui para o seguinte.",
        "Eight steps through the Supreme Soviet. Each one opens the tab it is about; come back here for the next.": "Oito passos pelo Soviete Supremo. Cada um abre o separador de que trata; volta aqui para o seguinte.",
        "GUIDE BACK": "ANTERIOR",
        "GUIDE NEXT": "SEGUINTE",
        "GUIDE GO THERE": "IR PARA LÁ",
        "GUIDE FINISH": "TERMINAR",
        "Every delegate seated in this dome is one vote. A bill needs a majority, and a few kinds need a supermajority. Bringing a bill never costs credits; what the bill does may.": "Cada delegado sentado nesta cúpula vale um voto. Uma proposta precisa de maioria e algumas precisam de maioria qualificada. Apresentar uma proposta nunca custa créditos; o que ela faz pode custar.",
        "A PARTY, NOT A LONE VOICE": "UM PARTIDO, NÃO UMA VOZ SÓ",
        "Join a party in PARTY. Delegates lean with their party, the party with the most seats chairs the committees, and only a party's members may report its committee's bills.": "Entra num partido em PARTIDO. Os delegados inclinam-se com o partido, o partido com mais cadeiras preside às comissões, e só os membros de um partido podem relatar as propostas da sua comissão.",
        "PROPOSING": "PROPOR",
        "In NEW PROPOSAL you bring a bill yourself, of any kind the chamber allows. If you hold no seat the factions still bring their own every few minutes.": "Em NOVA PROPOSTA apresentas uma proposta tu mesmo, do género que a câmara permitir. Se não tiveres cadeira, as facções continuam a trazer as suas a cada poucos minutos.",
        "THE DOME": "A CÚPULA",
        "While a bill is live the dome moves: delegates are swayed by the debate, the standing of the parties and the Authority's popularity. Green seats are yes, red are no.": "Enquanto uma proposta está viva a cúpula mexe-se: os delegados são convencidos pelo debate, pela força dos partidos e pela popularidade da Autoridade. Verde é sim, vermelho é não.",
        "THE VOTE": "A VOTAÇÃO",
        "At the vote a bill passes or fails, and a bill that passes is carried out at once: a war declared, a fleet authorised, credits moved.": "Na votação a proposta passa ou cai, e a que passa é executada de imediato: uma guerra declarada, uma frota autorizada, créditos movidos.",
        "TWO CHAIRS, NOT ONE": "DUAS CADEIRAS, NÃO UMA",
        "The President leads the Freedom Authority and is elected by its players. The Speaker leads this chamber and holds the veto. Two people, two elections.": "O Presidente lidera a Freedom Authority e é eleito pelos seus jogadores. O Presidente da Câmara lidera esta câmara e detém o veto. Duas pessoas, duas eleições.",
        "Three committees schedule the bills. The party in a chair may send one of its own bills straight to the vote, once a term. The President names three ministers, each of whom may act once a term.": "Três comissões agendam as propostas. O partido que preside pode mandar uma das suas propostas directamente à votação, uma vez por mandato. O Presidente nomeia três ministros, e cada um pode agir uma vez por mandato.",
        "WORLDS YOU HOLD": "OS MUNDOS QUE DOMINAS",
        "A conquered world is administered on OCCUPIED WORLDS: relief raises its stability, unrest rises while no fleet of ours is in its orbit, and at a hundred it throws the occupation off.": "Um mundo conquistado é administrado em MUNDOS OCUPADOS: o alívio sobe a sua estabilidade, a agitação cresce enquanto nenhuma frota nossa estiver na sua órbita, e aos cem expulsa a ocupação.",
        "THAT IS THE CONGRESS": "O CONGRESSO É ISTO",
        "Everything the chamber does is on these tabs, and taking part costs nothing: no credits to propose, no credits to vote. The record of it all is on NEWS.": "Tudo o que a câmara faz está nestes separadores, e participar não custa nada: nada para propor, nada para votar. O registo de tudo está em NOTÍCIAS.",
        "Every commissar in this hall is one vote, and a directive needs a qualified majority of the plenum. Putting one forward never costs credits; carrying it out may.": "Cada comissário nesta sala vale um voto, e uma directiva precisa de maioria qualificada do pleno. Apresentá-la nunca custa créditos; executá-la pode custar.",
        "A CURRENT, NOT A LONE VOICE": "UMA CORRENTE, NÃO UMA VOZ SÓ",
        "Join a current in PARTY: the Proletarian Vanguard, the Party Apparatus, Red Command. The greatest current chairs the committees.": "Entra numa corrente em PARTIDO: a Vanguarda Proletária, o Aparato do Partido, o Comando Vermelho. A maior corrente preside às comissões.",
        "In NEW DIRECTIVE you bring one yourself. The currents bring their own as well, and the plenum sits only while a Combine player is online.": "Em NOVA DIRECTIVA apresentas uma tu mesmo. As correntes também trazem as suas, e o pleno só se reúne enquanto houver um jogador do Combine em linha.",
        "THE SHOW OF HANDS": "O VOTO DE MÃOS",
        "While a directive is live the hall moves: the Soviet's confidence and its relations with the other side decide how the commissars lean, and the debate pulls them further.": "Enquanto uma directiva está viva a sala mexe-se: a confiança do Soviete e as suas relações com o outro lado decidem para onde os comissários se inclinam, e o debate puxa-os mais longe.",
        "A carried directive is executed at once: a campaign authorised, a quota raised, a fleet ordered or struck from the rolls.": "Uma directiva aprovada é executada de imediato: uma campanha autorizada, uma quota subida, uma frota encomendada ou riscada dos registos.",
        "The High Commissar leads the Combine and is elected by its players. The Secretary presides over the plenum and holds the veto. Two offices, two elections.": "O Alto Comissário lidera o Combine e é eleito pelos seus jogadores. O Secretário preside ao pleno e detém o veto. Dois cargos, duas eleições.",
        "Three committees schedule the directives, and the current in a chair may report one straight to the vote once a term. The High Commissar names the ministers.": "Três comissões agendam as directivas, e a corrente que preside pode relatar uma directamente à votação uma vez por mandato. O Alto Comissário nomeia os ministros.",
        "WORLDS TAKEN": "OS MUNDOS TOMADOS",
        "A world the Combine pacifies is administered on OCCUPIED WORLDS, and every world fully pacified sends one more commissar to this hall.": "Um mundo que o Combine pacifique é administrado em MUNDOS OCUPADOS, e cada mundo totalmente pacificado envia mais um comissário para esta sala.",
        "THAT IS THE SOVIET": "O SOVIETE É ISTO",
        "Everything the Combine does is on these tabs, and taking part costs nothing: no credits to propose, no credits to vote. The record of it all is on AGITPROP and NEWS.": "Tudo o que o Combine faz está nestes separadores, e participar não custa nada: nada para propor, nada para votar. O registo de tudo está em AGITPROP e NOTÍCIAS.",
        "PHONE MODE": "MODO TELEMÓVEL",
        "DESKTOP MODE": "MODO COMPUTADOR",
        "WORLDS": "MUNDOS",
        "SEARCH A WORLD": "PROCURAR UM MUNDO",
        "NO WORLD MATCHES": "NENHUM MUNDO CORRESPONDE",
        "SELECT A FLEET FIRST": "SELECIONA PRIMEIRO UMA FROTA",
        "TAP A WORLD ON THE MAP TO SEND THIS FLEET": "TOCA NUM MUNDO NO MAPA PARA ENVIAR ESTA FROTA",
        "CLOSE": "FECHAR",
        "ZOOM IN": "APROXIMAR",
        "ZOOM OUT": "AFASTAR",
        "FIT THE MAP": "AJUSTAR O MAPA",
        "SEND THE FLEET TO A WORLD": "ENVIAR A FROTA PARA UM MUNDO",

        /* ---------- the dock, when it cannot work (2026-11-18) ---------- */
        "You cannot repair here: this world is neutral or hostile. A dock needs a world your faction holds.": "Não podes reparar aqui: este mundo é neutro ou hostil. Uma doca precisa de um mundo que a tua facção controle.",

        /* ---------- the recruiting office, when it cannot work (2026-11-18) ---------- */
        "You cannot recruit here: this world is neutral or hostile. Recruits are raised on a world your faction holds.": "Não podes recrutar aqui: este mundo é neutro ou hostil. Os recrutas são formados num mundo que a tua facção controle.",

        /* ---------- the cargo fleets (2026-11-30 / 2026-11-31) ---------- */
        "You cannot recruit here: this is a cargo fleet. A slaving fleet carries Tusken, not soldiers.": "Não podes recrutar aqui: esta é uma frota de carga. Uma frota de escravos transporta Tusken, não soldados.",
        "CARGO FLEET — IT CARRIES TUSKEN, NOT SOLDIERS": "FROTA DE CARGA — TRANSPORTA TUSKEN, NÃO SOLDADOS",

        /* ---------- a half-applied committee patch (2026-11-19) ---------- */
        "This database still has an earlier version of the committee functions. Run sql/2026-11-15_committees_and_ministers.sql again: it replaces them.": "Esta base de dados ainda tem a versão anterior das funções das comissões. Rode sql/2026-11-15_committees_and_ministers.sql outra vez: ele substitui-as.",
        "Recruits are raised on a world your faction holds: this fleet is not in orbit of one.": "Os recrutas são formados num mundo que a tua facção controle: esta frota não está em órbita de nenhum.",
        "A dock needs a world your faction holds: this fleet is not in orbit of one.": "Uma doca precisa de um mundo que a tua facção controle: esta frota não está em órbita de nenhum.",

        /* ---------- the two chairs (2026-11-06). The chamber's own chair became
           the Speaker of the Congress on 2026-11-12, so one president is left. ---------- */
        "THE TWO CHAIRS": "AS DUAS CADEIRAS",
        "PRESIDENT OF THE FREEDOM AUTHORITY": "PRESIDENTE DA FREEDOM AUTHORITY",
        "SPEAKER OF THE CONGRESS": "ORADOR DO CONGRESSO",
        "The faction's leader": "O líder da facção",
        "The chamber's own chair": "A cadeira da própria casa",
        "The President leads the faction: 5 proposals before Congress (others 3), the ruling party's agenda heard more often, and the state's initiatives for new fleets and squads come in the President's name. The gavel and the veto belong to the Speaker of the Congress, not to this chair.":
            "O Presidente lidera a facção: 5 propostas no Congresso (os outros 3), a agenda do partido no poder é ouvida mais vezes, e as iniciativas do Estado para novas frotas e esquadrões chegam em nome do Presidente. O martelo e o veto pertencem ao Orador do Congresso, não a esta cadeira.",
        "Election of the President of the Freedom Authority": "Eleição do Presidente da Freedom Authority",
        "Election of the Speaker of the Congress": "Eleição do Orador do Congresso",
        "The Speaker of the Congress leads the chamber and holds its veto, and has used it this term.":
            "O Orador do Congresso lidera a casa e detém o seu veto, e já o usou neste mandato.",
        "The Speaker of the Congress leads the chamber and holds its veto: one bill a term.":
            "O Orador do Congresso lidera a casa e detém o seu veto: uma proposta por mandato.",
        "The next election starts when the term ends.": "A próxima eleição começa quando o mandato terminar.",
        "no party": "sem partido",
        "votes": "votos",
        "RUN FOR SPEAKER OF THE CONGRESS": "CANDIDATAR-SE A ORADOR DO CONGRESSO",
        "The chamber elects its own speaker with sql/2026-11-06_orbits_repairs_unrest_and_offices.sql. Run it, then reload this page.":
            "A casa elege o seu próprio orador com sql/2026-11-06_orbits_repairs_unrest_and_offices.sql. Execute-o e recarregue esta página.",
        "You are a candidate for Speaker of the Congress.": "Você é candidato a Orador do Congresso.",
        "Only the Speaker of the Congress may veto": "Só o Orador do Congresso pode vetar.",
        "Vetoed.": "Vetado.",

        /* ---------- the ship's wireless (2026-11-06) ---------- */
        "Music": "Música",
        "SHIP'S WIRELESS": "RÁDIO DE BORDO",
        "Playing:": "Tocando:",
        "Paused.": "Pausada.",
        "No music yet: add a track below.": "Ainda sem música: adicione uma faixa abaixo.",
        "That track could not be played.": "Não foi possível tocar essa faixa.",
        "(this session)": "(esta sessão)",
        "paste a link to an audio file": "cole um link para um ficheiro de áudio",
        "ADD BY LINK": "ADICIONAR POR LINK",
        "PICK A FILE": "ESCOLHER FICHEIRO",
        "A link is remembered in this browser. A file from this computer plays until the page is closed.":
            "Um link fica guardado neste navegador. Um ficheiro deste computador toca até a página ser fechada.",
        "Paste a link to an audio file first.": "Cole primeiro um link para um ficheiro de áudio.",

        /* ---------- the shared wireless (2026-11-08) ---------- */
        "MUTE": "SEM SOM",
        "UNMUTE": "COM SOM",
        "The host chooses the music. You can mute it for yourself.":
            "O anfitrião escolhe a música. Pode silenciá-la para si.",
        "A file from this computer plays only on your screen: put it online and add its link to share it.":
            "Um ficheiro deste computador toca apenas no seu ecrã: coloque-o online e adicione o link para o partilhar.",
        "The wireless lives in the database: run sql/2026-11-08_shared_music_playlist.sql, then reload.":
            "A rádio vive na base de dados: execute sql/2026-11-08_shared_music_playlist.sql e recarregue.",
        "ON YOUR SCREEN ONLY": "SÓ NO SEU ECRÃ",
        "Adding...": "A adicionar...",
        "The wireless is silent: nobody has put a track on yet.":
            "A rádio está em silêncio: ainda ninguém pôs uma faixa.",

        /* ---------- page titles ---------- */
        "Galactic Front - Galaxy Map": "Galactic Front - Mapa da Galáxia",
        "Galactic Front - Planet": "Galactic Front - Planeta",
        "Galactic Wars - City Battle": "Galactic Wars - Batalha Urbana",
        /* ---------- Tuskara, the slave trade and the reset ---------- */
        "THE TUSKEN HOMEWORLD · NOTHING IS CONQUERED HERE, ONLY SETTLED": "O MUNDO NATAL DOS TUSKEN · AQUI NADA É CONQUISTADO, SÓ COLONIZADO",
        "FACTION CREDITS": "CRÉDITOS DA FACÇÃO",
        "IN THE PENS": "NOS CERCOS",
        "TUSKEN AT WORK": "TUSKEN EM SERVIÇO",
        "THEIR INCOME": "A RENDA DELES",
        "ORBIT": "ÓRBITA",
        "Every 1,000 Tusken put to work on a world add 1 credit to that world's payment. On Tuskara itself they earn nothing — a slave is only worth the ship that carries it, and a settlement needs a fleet overhead before the bands walk out. A transport joins a fleet: the hulls give that fleet its lift, and the fleet carries the load — through an enemy orbit, if the escort is strong enough.": "Cada 1.000 tusken postos a trabalhar em um mundo somam 1 crédito ao pagamento desse mundo. No próprio Tuskara eles não rendem nada — um escravo vale apenas pelo navio que o carrega, e um assentamento precisa de uma frota em órbita antes de os bandos saírem. Um transporte entra numa frota: os cascos dão a ela a capacidade, e a frota leva a carga — por uma órbita inimiga, se a escolta for forte o bastante.",
        "SETTLEMENT": "ASSENTAMENTO",
        "FOUND A SETTLEMENT": "FUNDAR UM ASSENTAMENTO",
        "TRANSPORT FLEETS": "FROTAS DE TRANSPORTE",
        "THE ONLY FLEETS A HULL SAILS WITH": "AS ÚNICAS FROTAS COM QUE UM CASCO NAVEGA",
        "TRANSPORTS": "TRANSPORTES",
        "THE FLEET THE NEXT HULL JOINS": "A FROTA QUE O PRÓXIMO CASCO INTEGRA",
        "BUY A TRANSPORT": "COMPRAR UM TRANSPORTE",
        "A FLEET OF TRANSPORTS ONLY — NO CONGRESS, NO QUOTA": "UMA FROTA SÓ DE TRANSPORTES — SEM CONGRESSO, SEM COTA",
        "Transport fleet name": "Nome da frota de transporte",
        "FOUR TRANSPORT FLEETS — THE LIMIT": "QUATRO FROTAS DE TRANSPORTE — O LIMITE",
        "SEND A LOAD": "ENVIAR UMA CARGA",
        "THE TRIP IS FREE": "A VIAGEM É GRÁTIS",
        "CARRIED BY": "TRANSPORTADA POR",
        "FROM": "DE",
        "TO": "PARA",
        "HOW MANY": "QUANTOS",
        "SEND THE LOAD": "ENVIAR A CARGA",
        "AT WORK": "EM SERVIÇO",
        "WHAT THEY PAY": "O QUE ELES RENDEM",
        "CONVOYS": "COMBOIOS",
        "ON THE ROAD": "NA ESTRADA",
        "UNKNOWN SETTLEMENT": "ASSENTAMENTO DESCONHECIDO",
        "UNSCOUTED": "NÃO EXPLORADO",
        "FINISHED": "CONCLUÍDO",
        "PENS": "CERCOS",
        "GROW THE SETTLEMENT": "AMPLIAR O ASSENTAMENTO",
        "BETTER BANDS (CATCH)": "MELHORES BANDOS (CAPTURA)",
        "BIGGER PENS (HOLD)": "CERCOS MAIORES (CAPACIDADE)",
        "NO MORE SETTLEMENTS": "NENHUM ASSENTAMENTO A MAIS",
        "NO FLEET IN ORBIT": "NENHUMA FROTA EM ÓRBITA",
        "IN ORBIT": "EM ÓRBITA",
        "NOWHERE": "EM LUGAR NENHUM",
        "AT SEA": "NO MAR",
        "DOCKED": "ATRACADO",
        "NO FLEET": "SEM FROTA",
        "NO HULLS": "SEM CASCOS",
        "NO TRANSPORT FLEET — FORM ONE BELOW": "NENHUMA FROTA DE TRANSPORTE — FORME UMA ABAIXO",
        "NOWHERE YET": "AINDA EM LUGAR NENHUM",
        "NO SLAVING FLEET HERE": "NENHUMA FROTA ESCRAVISTA AQUI",
        "No transports. Buy a hull, name the fleet it joins, and it is yours for good.": "Nenhum transporte. Compre um casco, diga a frota que ele integra, e ele é seu para sempre.",
        "No transport fleet yet. A hull sails with one of those, and one costs nothing but credits — form it below.": "Ainda não há frota de transporte. Um casco navega com uma delas, e ela custa apenas créditos — forme uma abaixo.",
        "No Tusken are at work yet. Send a load.": "Nenhum tusken está em serviço ainda. Envie uma carga.",
        "No ships on the road.": "Nenhum navio na estrada.",
        "Nothing to load here.": "Não há nada para carregar aqui.",
        "No fleet to join: a hull has to be given to one of your fleets.": "Nenhuma frota para integrar: um casco tem de ser entregue a uma das suas frotas.",
        "There is nowhere to land the load: hold a world whole first.": "Não há onde desembarcar a carga: domine um mundo inteiro primeiro.",
        "The load needs a number of Tusken in it.": "A carga precisa de um número de tusken.",
        "Press a settlement on the globe. You know every one of your own; a rival's takes a spy.": "Pressione um assentamento no globo. Você conhece todos os seus; o de um rival exige um espião.",
        "Not ours, and nothing is known of it: no name, no owner, no count of the pens. Only a spy can open it.": "Não é nosso, e nada se sabe dele: nenhum nome, nenhum dono, nenhuma contagem dos cercos. Só um espião pode abri-lo.",
        "SLAVES": "ESCRAVOS",
        "THE LEDGER OF THE TUSKEN": "O LIVRO DOS TUSKEN",
        "PENS ON TUSKARA": "CERCOS EM TUSKARA",
        "THEY PAY": "ELES PAGAM",
        "EVERY 1,000": "A CADA 1.000",
        "1 CREDIT": "1 CRÉDITO",
        "WORLDS HOLDING TUSKEN": "MUNDOS COM TUSKEN",
        "None at work: the pens are full and nothing has been shipped.": "Nenhum em serviço: os cercos estão cheios e nada foi enviado.",
        "DESTINATION": "DESTINO",
        "Only the Freedom Authority and the Combine ship the Tusken": "Só a Freedom Authority e o Combine transportam os tusken",
        "Only the Freedom Authority and the Combine settle Tuskara": "Só a Freedom Authority e o Combine colonizam Tuskara",
        "Only the Freedom Authority and the Combine keep spies": "Só a Freedom Authority e o Combine mantêm espiões",
        "Choose the transport fleet the hull is to join": "Escolha a frota de transporte que o casco vai integrar",
        "Choose the fleet the transport is to join": "Escolha a frota que o transporte vai integrar",
        "Choose the fleet that carries the load": "Escolha a frota que leva a carga",
        "There is no such fleet": "Não existe essa frota",
        "There is no such settlement": "Não existe esse assentamento",
        "That fleet is not yours": "Essa frota não é sua",
        "That settlement is ours: no spy is needed": "Esse assentamento é nosso: não é preciso espião",
        "That fleet is in battle: no hull joins it until the shooting stops": "Essa frota está em batalha: nenhum casco a integra até o tiroteio parar",
        "A hull sails only in a transport fleet: form one first, and no chamber has to approve it": "Um casco navega só numa frota de transporte: forme uma primeiro, e nenhuma câmara precisa aprovar",
        "A slaving fleet carries Tusken, not soldiers: no troops can be raised into it": "Uma frota escravista leva tusken, não soldados: nenhuma tropa pode ser recrutada nela",
        "No fleet of yours is in orbit of Tuskara: bring one before you settle the dust": "Nenhuma frota sua está em órbita de Tuskara: leve uma antes de assentar a poeira",
        "A load can only be landed on a world you hold whole": "Uma carga só pode ser desembarcada num mundo que você domina inteiro",
        "The ship is already there": "O navio já está lá",
        "This account is not part of the war": "Esta conta não faz parte da guerra",
        "The reset finished, but the newer systems could not be cleared:": "O reinício terminou, mas os sistemas mais novos não puderam ser limpos:",
        "The whole game is back to the start.": "O jogo inteiro voltou ao começo.",
        "Only the President of the Congress may veto": "Só o Presidente da Câmara pode vetar",
        "The veto of this term has been used": "O veto deste mandato já foi usado",
        "Only a live bill can be vetoed": "Só um projeto em andamento pode ser vetado",

    };

    /* prefixes: matched only at the start of a text node, so the value
       that follows (a fleet name, a number, a planet) is preserved */
    const PREFIX = [
        ["FLEET UNDER WAY. ETA", "FROTA EM ROTA. PREVISÃO"],
        ["FLEET TRAVELLING. ETA", "FROTA EM VIAGEM. PREVISÃO"],
        ["FACTION CREDITS:", "CRÉDITOS DA FACÇÃO:"],
        ["Logged in as", "Conectado como"],
        ["Already offered:", "Já oferecido:"],
        ["Offer made (", "Oferta feita ("],
        ["This fleet belongs to the", "Esta frota pertence à"],
        ["Reinforcing the", "Reforçando a"],
        ["Reinforcements have arrived for the", "Reforços chegaram para a"],
        ["The leadership needs a moment before the next matter (", "A liderança precisa de um momento antes do próximo assunto ("],
        ["Congress has not declared war on", "O Congresso não declarou guerra contra"],
        ["Battle started. Garrison level", "Batalha iniciada. Nível da guarnição"],
        ["Could not build:", "Não foi possível construir:"],
        ["Could not upgrade garrison:", "Não foi possível melhorar a guarnição:"],
        ["Could not enter the battle:", "Não foi possível entrar na batalha:"],
        ["Could not join the battle:", "Não foi possível juntar-se à batalha:"],
        ["Could not start battle:", "Não foi possível iniciar a batalha:"],
        ["Could not save battle result:", "Não foi possível salvar o resultado da batalha:"],
        ["Could not change maintenance mode:", "Não foi possível alterar o modo de manutenção:"],
        ["Reset failed:", "Falha ao reiniciar:"],
        ["Forecast: about", "Previsão: cerca de"],
        ["Held by:", "Controlada por:"],
        ["Backed by:", "Apoiada por:"],
        ["· held by", "· controlada por"],
        ["Relationship with you:", "Relação com você:"],
        ["Relief for", "Ajuda para"],
        ["STABILITY", "ESTABILIDADE"],
        ["LOYALTY", "LEALDADE"],
        ["Seats:", "Cadeiras:"],
        ["Votes:", "Votos:"],
        ["Needed:", "Necessários:"],
        ["ETA ", "PREVISÃO "],
        ["Training", "Treinando"],
        ["Units:", "Unidades:"],
        ["Fleet:", "Frota:"],
        ["Target:", "Alvo:"],
        ["Cost:", "Custo:"],
        ["Cost ", "Custo "],
        ["Status:", "Status:"],
        ["Planet:", "Planeta:"],
        ["SEND A SPY — ", "ENVIAR UM ESPIÃO — "],
        ["BUY A TRANSPORT — ", "COMPRAR UM TRANSPORTE — "],
        ["FORM A FLEET — ", "FORME UMA FROTA — "],
        ["THE BANDS REST — ", "OS BANDOS DESCANSAM — "],
        ["SCOUTED · THE SPY IS STILL INSIDE · ", "EXPLORADO · O ESPIÃO AINDA ESTÁ DENTRO · "],
        ["No transport fleet in orbit of ", "Nenhuma frota de transporte em órbita de "],
        ["No slaving fleet in orbit of ", "Nenhuma frota escravista em órbita de "],
        ["No hull yet: ", "Nenhum casco ainda: "],
        ["takes up to ", "captura até "],
        ["Up to ", "Até "],
        ["The settlements answer nothing: ", "Os assentamentos não respondem: "],
        ["The ledgers answer nothing: ", "Os livros não respondem: "],
        ["FOUND A SETTLEMENT — ", "FUNDAR UM ASSENTAMENTO — "],

    ];

    /* trailing words after a number: "176 DELEGATES", "12 VOTES" */
    const SUFFIX = [
        [" DELEGATES", " DELEGADOS"],
        [" SEATS", " CADEIRAS"],
        [" VOTES", " VOTOS"],
        [" CREDITS", " CRÉDITOS"],
        [" UNITS", " UNIDADES"],
        [" SOLDIERS", " SOLDADOS"],
        [" SETTLED", " COLONIZADOS"],
        [" HULLS", " CASCOS"],
        [" LIFT", " CAPACIDADE"],
        [" / PAYMENT", " / PAGAMENTO"],
    ];

    /* sentences with numbers or names inside them: a word-for-word table
       cannot translate "A transport costs 350 credits" without losing the
       350, so these are matched as patterns and the values are kept */
    const RULES = [
        [ /^([\d.,]+) HULLS · ([\d.,]+) LIFT$/, "$1 CASCOS · $2 CAPACIDADE" ],
        [ /^([\d.,]+) OF ([\d.,]+) SETTLED$/, "$1 DE $2 COLONIZADOS" ],
        [ /^([\d.,]+) IN PORT · ([\d.,]+) A HULL$/, "$1 NO PORTO · $2 POR CASCO" ],
        [ /^\+([\d.,]+) \/ PAYMENT$/, "+$1 / PAGAMENTO" ],
        [ /^AT SEA → (.+)$/, "NO MAR → $1" ],
        [ /^takes up to ([\d.,]+) an hour$/, "captura até $1 por hora" ],
        [ /^Up to ([\d.,]+) on the (.+) · ([\d.,]+) lift · the trip is free$/, "Até $1 no $2 · $3 de capacidade · a viagem é grátis" ],
        [ /^A transport fleet costs ([\d.,]+) credits$/, "Uma frota de transporte custa $1 créditos" ],
        [ /^A transport costs ([\d.,]+) credits$/, "Um transporte custa $1 créditos" ],
        [ /^A spy costs ([\d.,]+) credits$/, "Um espião custa $1 créditos" ],
        [ /^A settlement costs ([\d.,]+) credits$/, "Um assentamento custa $1 créditos" ],
        [ /^Our eyes are still inside that settlement: (\d+) seconds left$/, "Nossos olhos ainda estão dentro desse assentamento: $1 segundos restantes" ],
        [ /^The bands are still moving: another settlement in (\d+) seconds$/, "Os bandos ainda se movem: outro assentamento em $1 segundos" ],
        [ /^The dust will not feed another settlement: (\d+) stand already$/, "A poeira não alimenta outro assentamento: $1 já estão de pé" ],
        [ /^The (.+) is not in port: a fleet at sea cannot take a load$/, "A $1 não está no porto: uma frota no mar não pode levar carga" ],
        [ /^The (.+) carries no transports: buy a hull for it first$/, "A $1 não tem transportes: compre um casco para ela primeiro" ],
        [ /^The (.+) is in orbit of (.+), not (.+): the load is waiting at (.+)$/, "A $1 está em órbita de $2, não de $3: a carga espera em $4" ],
        [ /^An enemy fleet holds the orbit of (.+): the load cannot sail$/, "Uma frota inimiga domina a órbita de $1: a carga não pode zarpar" ],
        [ /^There are no Tusken waiting at (.+)$/, "Não há tusken esperando em $1" ],
        [ /^A settlement rises at (.+), for ([\d.,]+) credits\. (.+) holds the orbit\.$/, "Um assentamento nasce em $1, por $2 créditos. $3 domina a órbita." ],
        [ /^(.+) joins the (.+), for ([\d.,]+) credits\. The fleet now carries ([\d.,]+)\.$/, "$1 entra na $2, por $3 créditos. A frota agora carrega $4." ],
        [ /^The work is done: (.+), for ([\d.,]+) credits\.$/, "A obra está feita: $1, por $2 créditos." ],
        [ /^(.+) is formed at Tuskara for ([\d.,]+) credits — no bill and no quota\. Give it hulls and it can sail\.$/, "$1 é formada em Tuskara por $2 créditos — sem projeto e sem cota. Dê cascos a ela e ela navega." ],
        [ /^([\d.,]+) Tusken aboard the (.+) for (.+) — ([\d.,]+) hulls?, the trip costs nothing, (.+) on the road\.$/, "$1 tusken a bordo da $2 para $3 — $4 cascos, a viagem não custa nada, $5 na estrada." ],
        [ /^(.+) is ours to read for (.+): ([\d.,]+) in the pens, size (.+), catch (.+), hold (.+) — the spy cost ([\d.,]+) credits\.$/, "$1 está aberto para nós por $2: $3 nos cercos, tamanho $4, captura $5, capacidade $6 — o espião custou $7 créditos." ],
    ];


    /* never translated, even if a dictionary key would match */
    const PROTECTED = /^(GALACTIC WARS|GALACTIC FRONT|THE GALACTIC FRONT|Galactic Wars: The Galactic Front|Freedom Authority|Combine|Independents|Free Earth|Krieg|Vraks|Ultramars|Liberty City|New Ardent|New Lisbon|Rifle|MG|Assault|AT|Sniper|Tank|Artillery|Krieg|Arstartes|Knightmare)$/;

    const ENTITIES = {
        "&amp;": "&", "&nbsp;": " ", "&middot;": "·", "&larr;": "←", "&rarr;": "→",
        "&times;": "×", "&hellip;": "…", "&quot;": "\"", "&#039;": "'", "&lt;": "<", "&gt;": ">"
    };

    /* =====================================================
       SERVER TEXT — Portuguese back to English
       -----------------------------------------------------
       Everything the DATABASE writes is stored in Portuguese by
       the pt_text triggers: proposal titles, proposal results,
       the Congress log, the war log and the faction
       descriptions. Those strings never pass through DICT, so a
       player who chose English was shown Portuguese anyway.
       This is the other direction: the same sentences, written
       in Portuguese by the server, translated back. Only exact
       matches and the patterns below are touched, so a name, a
       planet or a wording the server changed is left alone.
    ===================================================== */

    const SERVER = {

        /* occupation stages */
        "ocupado": "occupied",
        "administração civil": "civilian administration",
        "protegido": "protected",
        "integrado": "integrated",

        /* proposal titles */
        "Autorizar a construção de uma nova frota":
            "Authorize New Fleet Construction",
        "Autorizar a construção de uma nova frota (iniciativa do Estado)":
            "Authorize New Fleet Construction (state initiative)",
        "Autorizar a formação de um esquadrão Knightmare":
            "Authorize Knightmare Squad Formation",
        "Autorizar a formação de um esquadrão Knightmare (iniciativa do Estado)":
            "Authorize Knightmare Squad Formation (state initiative)",
        "Ajuda econômica de emergência": "Emergency Economic Relief",
        "Proposta de aumento de impostos": "Taxation Increase Proposal",

        /* proposal results */
        "Uma nova frota foi autorizada: construa-a no mapa galáctico.":
            "A new fleet is authorised: build it from the galaxy map.",
        "Um esquadrão Knightmare foi autorizado: recrute-o em uma frota (a cadeia da Instalação Knightmare ainda é necessária).":
            "A Knightmare squad is authorised: recruit it into a fleet (the Knightmare Facility chain is still required).",
        "Ajuda econômica para todos os mundos ocupados: estabilidade +10.":
            "Economic relief for all occupied worlds: stability +10.",
        "Impostos aumentados: 300-500 créditos a cada 15 minutos por nível de imposto; a Autoridade perde popularidade.":
            "Taxes raised: 300-500 credits every 15 minutes per tax level; the Authority loses popularity.",
        "A frota não pôde ser recolhida (ela não existe mais ou está em batalha).":
            "The fleet could not be recalled (it no longer exists or is in battle).",
        "O Presidente vetou esta proposta.": "The President vetoed this proposal.",
        "O Presidente deixou a Freedom Authority: o cargo está vago.":
            "The President has left the Freedom Authority: the office is vacant.",

        /* election log lines */
        "ELEIÇÃO: uma eleição presidencial foi convocada. Entre em um partido, declare sua candidatura (8 minutos) e então todos os jogadores votam (8 minutos).":
            "ELECTION: a presidential election is called. Join a party, then declare your candidacy (8 minutes), then all players vote (8 minutes).",
        "ELEIÇÃO: ninguém se candidatou ainda. A campanha foi prorrogada por 5 minutos.":
            "ELECTION: nobody has declared yet. The campaign is extended by 5 minutes.",
        "ELEIÇÃO: a votação está aberta. Todo jogador da Freedom Authority que entrou em um partido pode votar.":
            "ELECTION: voting is open. Every Freedom Authority player who has joined a party may vote.",

        /* the four factions, as the pt_cg_faction trigger stores them */
        "Tradicional e militarista, com uma abordagem conservadora da expansão e do governo":
            "Traditional and militaristic, with a conservative approach to expansion and government",
        "Foco ambiental e diplomático, contrário à expansão agressiva":
            "Environmental and diplomatic focus, opposed to aggressive expansion",
        "Reformas progressistas e investimento em tecnologia e infraestrutura civil":
            "Progressive reforms and investment in technology and civil infrastructure",
        "Membros sem alinhamento, imprevisíveis, influenciados por argumentos ou subornos":
            "Unaligned members, unpredictable, swayed by argument or bribes",

        /* ---------- the Supreme Soviet, as the database stores it ---------- */
        "Vanguarda Proletária": "The Proletarian Vanguard",
        "Aparato do Partido": "The Party Apparatus",
        "Comando Vermelho": "Red Command",
        "Conselhos de operários e soldados: o plano vem de baixo e a guerra é de todos":
            "Workers' and soldiers' councils: the plan comes from below and the war belongs to everyone",
        "Engenheiros, planejadores e burocratas: tudo se mede em toneladas e em ordens cumpridas":
            "Engineers, planners and bureaucrats: everything is measured in tonnage and in orders carried out",
        "O exército fala no plenário, e fala alto": "The army speaks in the plenum, and speaks loudly",
        "Cota de nova frota": "New fleet quota",
        "Destacamento blindado": "Armoured detachment",
        "Plano de produção: elevar a cota": "Five-Year Plan: raise the quota",
        "A frota não pôde ser desativada (ela não existe mais ou está em batalha).":
            "The fleet could not be dismantled (it no longer exists or is in battle).",
        "A frota foi desativada: 500 créditos de sucata.":
            "The fleet is dismantled: 500 credits of salvage.",
        "O Alto Comissário vetou esta diretiva.": "The High Commissar vetoed this directive.",
        "Uma nova frota foi autorizada: construa-a no mapa galáctico.":
            "A new fleet is authorised: build it from the galaxy map.",
        "Um destacamento blindado foi autorizado: recrute-o para uma frota (a cadeia da Instalação Knightmare ainda é necessária).":
            "An armoured detachment is authorised: recruit it into a fleet (the Knightmare Facility chain is still required).",
        "Plano de produção elevado: 300-500 créditos a cada 15 minutos por nível (máximo 2); o Partido perde confiança.":
            "Production quota raised: 300-500 credits every 15 minutes per level (max 2); the Party loses confidence.",
        "ELEIÇÃO: uma campanha para Alto Comissário foi aberta. Entre em uma corrente do Partido, declare a candidatura (8 minutos) e então todos votam (8 minutos).":
            "ELECTION: a campaign for High Commissar is open. Join a current of the Party, declare your candidacy (8 minutes), then all players vote (8 minutes).",
        "ELEIÇÃO: a votação está aberta. Todo jogador do Combine que entrou em uma corrente pode votar.":
            "ELECTION: voting is open. Every Combine player who has joined a current may vote.",
        "ELEIÇÃO: ninguém se apresentou. O cargo continua vago.":
            "ELECTION: nobody stood. The office stays vacant.",

        /* the embassies of 2026-10-31 */
        "O mundo assina o pacto e entra na União.":
            "The world signs the pact and joins the Union.",
        "O mundo assina o pacto e entra na Autoridade.":
            "The world signs the pact and joins the Authority.",
    };

    /* lines that carry names, planets or numbers: matched by shape */
    const SERVER_RULES = [

        [/^Declaração de Guerra contra (.+)$/, "Declaration of War on $1"],
        [/^Ajuda econômica de emergência para (.+)$/, "Emergency Economic Relief for $1"],
        [/^Missão diplomática para os (.+)$/, "Diplomatic Mission to the $1"],
        [/^Recolhimento de ativo militar: frota "(.*)"$/, 'Military Asset Recall: fleet "$1"'],

        [/^O Congresso declarou guerra contra (.+): as frotas da Freedom Authority podem atacá-lo\.$/,
            "Congress has declared war on $1: Freedom Authority fleets may attack it."],
        [/^Ajuda econômica para (.+): estabilidade \+10\.$/, "Economic relief for $1: stability +10."],
        [/^Enviados à (.+): as relações melhoram\.$/, "Envoys sent to the $1: relations improve."],
        [/^A frota "(.*)" foi desativada: 500 créditos de sucata\.$/, 'The fleet "$1" is decommissioned: 500 credits of salvage.'],
        [/^O Congresso aprovou, mas a Autoridade não conseguiu pagar ([0-9]+) créditos\.$/,
            "Congress approved, but the Authority could not pay $1 credits."],

        /* these carry a proposal title inside, already stored in Portuguese:
           the quoted part is translated back as well */
        [/^PROPOSTA: (.+) leva "(.*)" ao Congresso\.$/, function (all, who, title) {
            return 'PROPOSAL: ' + who + ' puts "' + (lookupServer(title) || title) + '" before Congress.';
        }],
        [/^PROPOSTA: (.+) propõe "(.*)"\.$/, function (all, who, title) {
            return 'PROPOSAL: ' + who + ' propose "' + (lookupServer(title) || title) + '".';
        }],
        [/^(APROVADA|REJEITADA|SEM FUNDOS): "(.*)" \(([0-9]+) sim, ([0-9]+) não, ([0-9]+) abstenções; ([0-9]+) necessários\)\.? ?(.*)$/,
            function (all, verdict, title, yes, no, abstain, need, effect) {
                const word = verdict === "APROVADA" ? "PASSED" : verdict === "REJEITADA" ? "REJECTED" : "NO FUNDS";
                return word + ': "' + (lookupServer(title) || title) + '" (' + yes + " yes, " + no + " no, " + abstain +
                    " abstain; " + need + " needed). " + (lookupServer(effect) || effect);
            }],
        [/^ESCÂNDALO: o delegado (.*) foi flagrado em corrupção e removido\. (.*) assume a cadeira\.$/,
            "SCANDAL: delegate $1 exposed for corruption and removed. $2 takes the seat."],
        [/^ESCÂNDALO: uma rede de subornos foi exposta\. (.*) é removido, (.*) assume a cadeira\.$/,
            "SCANDAL: a bribery network is exposed. $1 is removed, $2 takes the seat."],
        [/^VETO: o Presidente (?!do Congresso)(.*) veta "(.*)"\.$/, function (all, who, title) {
            return 'VETO: President ' + who + ' vetoes "' + (lookupServer(title) || title) + '".';
        }],
        [/^IMPOSTOS: ([0-9]+) créditos arrecadados dos mundos membros\.$/,
            "TAXES: $1 credits collected from the member worlds."],
        [/^CAPTURADO: (.+) cai sob a Freedom Authority e entra em ocupação militar\.$/,
            "CAPTURED: $1 falls to the Freedom Authority and is placed under military occupation."],
        [/^PERDIDO: (.+) não está mais sob o controle da Autoridade\. Seus delegados deixam o Congresso\.$/,
            "LOST: $1 is no longer held by the Authority. Its delegates leave Congress."],
        [/^OCUPAÇÃO: (.+) avança para (.+)\.$/, "OCCUPATION: $1 advances to $2."],
        [/^CONGRESSO: (.+) envia um delegado \(([0-9]+) de ([0-9]+) cadeiras\)\.$/,
            "CONGRESS: $1 sends a delegate ($2 of $3 seats)."],
        [/^O Congresso se reúne: ([0-9]+) delegados de ([0-9]+) áreas em ([0-9]+) regiões\.$/,
            "Congress convenes: $1 delegates from $2 areas in $3 regions."],

        /* the chamber's chair, the Speaker (2026-11-12): the older wording is
           still read, because the log keeps what was written before it */
        [/^CONGRESSO: a eleição para (?:Presidente|Orador) do Congresso foi aberta\. Declare a candidatura \(8 minutos\), depois todos votam \(8 minutos\)\.$/,
            "CONGRESS: the election of the Speaker of the Congress is open. Declare your candidacy (8 minutes), then everybody votes (8 minutes)."],
        [/^CONGRESSO: ninguém se candidatou (?:à presidência do Congresso|a Orador do Congresso)\. A campanha foi prorrogada por 5 minutos\.$/,
            "CONGRESS: nobody stood for Speaker of the Congress. The campaign was extended by 5 minutes."],
        [/^CONGRESSO: a votação para (?:Presidente|Orador) do Congresso está aberta\.$/,
            "CONGRESS: the vote for Speaker of the Congress is open."],
        [/^CONGRESSO: (.*) é eleito (?:Presidente|Orador) do Congresso \(([0-9]+) voto\(s\)\)\. Toma a cadeira e o veto da casa\.$/,
            "CONGRESS: $1 is elected Speaker of the Congress ($2 vote(s)). They take the chair and the chamber's veto."],
        [/^CANDIDATURA: (.*) apresenta-se a (?:Presidente|Orador) do Congresso\.$/,
            "CANDIDACY: $1 stands for Speaker of the Congress."],
        [/^VETO: o (?:Presidente|Orador) do Congresso (.*) veta "(.*)"\.$/, function (all, who, title) {
            return 'VETO: the Speaker of the Congress ' + who + ' vetoes "' + (lookupServer(title) || title) + '".';
        }],

        [/^ELEIÇÃO: (.*) é eleito Presidente da Freedom Authority \((.*)\)\. ?(.*)$/,
            "ELECTION: $1 is elected President of the Freedom Authority ($2). $3"],
        [/^ELEIÇÃO: /, "ELECTION: "],
        [/^(.+) declara candidatura à Presidência\.$/, "$1 declares for President."],
        [/^(.+) entra em (The Old Guard|The Greens|Progressives|Independents)\.$/, "$1 joins $2."],

        /* the debate turning (2026-10-27) */
        [/^DEBATE: a câmara volta-se a favor de "(.*)": ([0-9]+) de ([0-9]+) votos prometidos\.$/,
            'DEBATE: the chamber turns for "$1": $2 of $3 votes promised.'],
        [/^DEBATE: a câmara volta-se contra "(.*)": só ([0-9]+) de ([0-9]+) votos prometidos\.$/,
            'DEBATE: the chamber turns against "$1": only $2 of $3 votes promised.'],

        /* propaganda (2026-10-27) */
        [/^PROPAGANDA: a campanha pela (.+) custou ([0-9]+) créditos e subiu a lealdade dos seus delegados em ([0-9]+) pontos\.$/,
            "PROPAGANDA: the campaign for $1 cost $2 credits and lifted the loyalty of its delegates by $3 points."],
        [/^PROPAGANDA: a campanha pela (.+) custou ([0-9]+) créditos e subiu a lealdade dos seus delegados em ([0-9]+) pontos; ([0-9]+) delegado\(s\) passaram-se para ela: (.*)\.$/,
            "PROPAGANDA: the campaign for $1 cost $2 credits and lifted the loyalty of its delegates by $3 points; $4 delegate(s) crossed over to it: $5."],


        /* the Supreme Soviet (2026-10-28) */
        [/^Campanha militar contra (.+)$/, "Military campaign against $1"],
        [/^Pacto fraterno com os (.+)$/, "Fraternal pact with the $1"],
        [/^Reatribuir e desmontar a frota "(.*)"$/, 'Reassign and dismantle the fleet "$1"'],
        [/^Campanha aprovada contra (.+): as frotas do Combine podem atacá-lo\.$/,
            "Campaign approved against $1: Combine fleets may attack it."],
        [/^Emissários enviados aos (.+): as relações melhoram\.$/, "Envoys sent to the $1: relations improve."],
        [/^DIRETIVA: (.+) leva "(.*)" ao Soviete\.$/, function (all, who, title) {
            return 'DIRECTIVE: ' + who + ' puts "' + (lookupServer(title) || title) + '" before the Soviet.';
        }],
        [/^DEBATE: o Soviete começa a debater "(.*)"\.$/, function (all, title) {
            return 'DEBATE: the Soviet takes up "' + (lookupServer(title) || title) + '".';
        }],
        [/^PLENO: o Soviete volta-se a favor de "(.*)": ([0-9]+) de ([0-9]+) votos prometidos\.$/, function (all, title, yes, need) {
            return 'PLENARY: the Soviet turns for "' + (lookupServer(title) || title) + '": ' + yes + ' of ' + need + ' votes promised.';
        }],
        [/^PLENO: o Soviete volta-se contra "(.*)": só ([0-9]+) de ([0-9]+) votos prometidos\.$/, function (all, title, yes, need) {
            return 'PLENARY: the Soviet turns against "' + (lookupServer(title) || title) + '": only ' + yes + ' of ' + need + ' votes promised.';
        }],
        [/^(APROVADA|REJEITADA): "(.*)" \(([0-9]+) sim, ([0-9]+) não, ([0-9]+) abstenções; ([0-9]+) necessários\)\.? ?(.*)$/,
            function (all, verdict, title, yes, no, abstain, need, effect) {
                return (verdict === "APROVADA" ? "PASSED" : "REJECTED") + ': "' + (lookupServer(title) || title) + '" (' +
                    yes + " yes, " + no + " no, " + abstain + " abstain; " + need + " needed). " + (lookupServer(effect) || effect);
            }],
        [/^VETO: o Alto Comissário (.*) veta "(.*)"\.$/, function (all, who, title) {
            return 'VETO: High Commissar ' + who + ' vetoes "' + (lookupServer(title) || title) + '".';
        }],
        [/^PLANO: ([0-9]+) créditos produzidos pelos mundos do Combine\.$/,
            "PLAN: $1 credits produced by the Combine's worlds."],
        [/^Eleito com ([0-9]+) voto\(s\)\.$/, "Elected with $1 vote(s)."],
        [/^Nenhum candidato\.$/, "No candidate."],
        [/^PARTIDO: (.+) entra em (Vanguarda Proletária|Aparato do Partido|Comando Vermelho)\.$/, function (all, who, current) {
            return who + ' joins ' + (lookupServer(current) || current) + '.';
        }],
        [/^CANDIDATURA: (.+) apresenta-se a Alto Comissário\.$/,
            "CANDIDACY: $1 stands for High Commissar."],
        [/^ELEIÇÃO: (.*) é eleito Alto Comissário do Combine \(([0-9]+) voto\(s\)\)\.$/,
            "ELECTION: $1 is elected High Commissar of the Combine ($2 vote(s))."],
        [/^EMBAIXADA: (.+) recebeu enviados (?:do Combine|da Freedom Authority): relações ([0-9]+)\/100\. ?(.*)$/,
            function (all, planet, relation, note) {
                return 'EMBASSY: ' + planet + ' received envoys: relations ' + relation + '/100. ' + (lookupServer(note) || note);
            }],
        [/^ADMINISTRAÇÃO: (.+) passa a represálias\.$/, "ADMINISTRATION: $1 is placed under reprisals."],
        [/^ADMINISTRAÇÃO: (.+) passa a amnistia\.$/, "ADMINISTRATION: $1 is placed under amnesty."],
        [/^ADMINISTRAÇÃO: (.+) passa a administração civil\.$/, "ADMINISTRATION: $1 is placed under civil rule."],
        [/^COMISSÃO: (.+) relata (.+) diretamente à votação\.$/, "COMMITTEE: $1 reports $2 straight to the vote."],
        [/^MINISTÉRIO: (.+) é nomeado para o (.+)\.$/, "MINISTRY: $1 is named to the $2."],
        [/^MINISTÉRIO: (.+) deixa o (.+)\.$/, "MINISTRY: $1 leaves the $2."],
        [/^MINISTÉRIO: (.+) fica vago\.$/, "MINISTRY: the $1 is left vacant."],
        [/^MINISTÉRIO: (.+) autoriza uma campanha contra (.+)\.$/, "MINISTRY: $1 authorises a campaign against $2."],
        [/^MINISTÉRIO: (.+) levanta ([0-9]+) créditos dos (mundos membros|oblasts)\.$/, "MINISTRY: $1 raises $2 credits from the member worlds."],
        [/^MINISTÉRIO: (.+) envia alívio a (.+)\.$/, "MINISTRY: $1 sends relief to $2."],
        [/^O assalto a (.+) teve sucesso\.$/, "The assault on $1 succeeded."],
        [/^O assalto a (.+) foi repelido\.$/, "The assault on $1 was repelled."]
    ];

    function normalize(text) {
        let s = String(text);
        for (const k in ENTITIES) {
            if (s.indexOf(k) !== -1) { s = s.split(k).join(ENTITIES[k]); }
        }
        return s.replace(/\s+/g, " ").trim();
    }

    /* the same table the other way round, so a sentence the server stored in
       English (an older row, or a new one whose Portuguese rule has not been
       written yet) is still shown in Portuguese */
    const SERVER_PT = {};
    for (const ptWord in SERVER) {
        if (!Object.prototype.hasOwnProperty.call(SERVER_PT, SERVER[ptWord])) {
            SERVER_PT[SERVER[ptWord]] = ptWord;
        }
    }

    /* which direction the page is being translated in, set by start() */
    let activeLookup = null;

    function lookup(raw) {
        const core = normalize(raw);
        if (!core || !/[A-Za-zÀ-ÿ]{2}/.test(core)) { return null; }
        if (PROTECTED.test(core)) { return null; }
        if (Object.prototype.hasOwnProperty.call(DICT, core)) { return DICT[core]; }
        if (Object.prototype.hasOwnProperty.call(SERVER_PT, core)) { return SERVER_PT[core]; }

        for (let i = 0; i < RULES.length; i++) {
            if (RULES[i][0].test(core)) { return core.replace(RULES[i][0], RULES[i][1]); }
        }

        for (let i = 0; i < PREFIX.length; i++) {
            const en = PREFIX[i][0];
            if (core.length > en.length && core.slice(0, en.length).toUpperCase() === en.toUpperCase()) {
                return PREFIX[i][1] + core.slice(en.length);
            }
        }

        for (let i = 0; i < SUFFIX.length; i++) {
            const en = SUFFIX[i][0];
            if (core.length > en.length && core.slice(-en.length).toUpperCase() === en.toUpperCase()) {
                return core.slice(0, -en.length) + SUFFIX[i][1];
            }
        }

        return null;
    }

    /* the same sentences coming back out of the database */
    function lookupServer(raw) {
        const core = normalize(raw);
        if (!core || !/[A-Za-z\u00c0-\u00ff]{2}/.test(core)) { return null; }
        if (PROTECTED.test(core)) { return null; }
        if (Object.prototype.hasOwnProperty.call(SERVER, core)) { return SERVER[core]; }

        for (let i = 0; i < SERVER_RULES.length; i++) {
            const rule = SERVER_RULES[i];
            if (rule[0].test(core)) { return core.replace(rule[0], rule[1]); }
        }

        return null;
    }

    function translateTextNode(node) {
        const raw = node.nodeValue;
        if (!raw || raw.length > 900) { return; }
        const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
        if (!m || !m[2]) { return; }
        const out = (activeLookup || lookup)(m[2]);
        if (out === null || out === m[2]) { return; }
        node.nodeValue = m[1] + out + m[3];
    }

    const ATTRS = ["placeholder", "title", "alt", "aria-label"];

    function translateElement(el) {
        if (!el || el.nodeType !== 1) { return; }
        const tag = el.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "PRE" || tag === "CODE") { return; }
        if (el.hasAttribute("data-no-i18n")) { return; }

        for (let i = 0; i < ATTRS.length; i++) {
            const a = ATTRS[i];
            if (!el.hasAttribute(a)) { continue; }
            const cur = el.getAttribute(a);
            const out = (activeLookup || lookup)(cur);
            if (out !== null && out !== cur) { el.setAttribute(a, out); }
        }

        if (tag === "INPUT" && (el.type === "button" || el.type === "submit" || el.type === "reset")) {
            const out = (activeLookup || lookup)(el.value);
            if (out !== null && out !== el.value) { el.value = out; }
        }
    }

    function translateTree(root) {
        if (!root) { return; }

        if (root.nodeType === 3) { translateTextNode(root); return; }
        if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) { return; }

        if (root.nodeType === 1) { translateElement(root); }

        if (root.querySelectorAll) {
            const elements = root.querySelectorAll("*");
            for (let i = 0; i < elements.length; i++) { translateElement(elements[i]); }
        }

        const doc = (root.ownerDocument || root);
        if (!doc.createTreeWalker) { return; }

        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                const p = n.parentNode;
                if (!p) { return NodeFilter.FILTER_REJECT; }
                const t = p.nodeName;
                if (t === "SCRIPT" || t === "STYLE" || t === "PRE" || t === "CODE") {
                    return NodeFilter.FILTER_REJECT;
                }
                if (p.hasAttribute && p.hasAttribute("data-no-i18n")) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const nodes = [];
        let n;
        while ((n = walker.nextNode())) { nodes.push(n); }
        for (let i = 0; i < nodes.length; i++) { translateTextNode(nodes[i]); }
    }

    /* ---------- language choice (ENG / PT on the main menu) ---------- */
    const LANG_KEY = "gf_lang";

    function currentLanguage() {
        try {
            return localStorage.getItem(LANG_KEY) === "en" ? "en" : "pt";
        }
        catch (e) {
            return "pt";
        }
    }

    function markLanguageButtons() {
        const cur = currentLanguage();
        const buttons = document.querySelectorAll("[data-lang]");
        for (let i = 0; i < buttons.length; i++) {
            const b = buttons[i];
            if (b.getAttribute("data-lang") === cur) { b.classList.add("on"); }
            else { b.classList.remove("on"); }
        }
    }


    /* everything created later (panels, toasts, logs, server text) is
       translated as it appears, in whichever direction is active */
    function observe() {

        if (typeof MutationObserver !== "function") { return; }

        const pending = new Set();
        let scheduled = false;

        function flush() {
            scheduled = false;
            const nodes = Array.from(pending);
            pending.clear();
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                if (n.isConnected === false) { continue; }
                translateTree(n);
            }
        }

        const observer = new MutationObserver(function (records) {
            for (let i = 0; i < records.length; i++) {
                const r = records[i];
                if (r.type === "characterData") { translateTextNode(r.target); continue; }
                for (let j = 0; j < r.addedNodes.length; j++) {
                    const added = r.addedNodes[j];
                    if (added.nodeType === 3) { translateTextNode(added); }
                    else if (added.nodeType === 1) { pending.add(added); }
                }
            }
            if (pending.size && !scheduled) {
                scheduled = true;
                (window.requestAnimationFrame || window.setTimeout)(flush, 16);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }


    function start() {

        markLanguageButtons();

        /* English: the pages are written in English and are left alone, but
           everything the database writes arrives in Portuguese, so that is
           translated back to English */
        if (currentLanguage() === "en") {

            document.documentElement.lang = "en";
            activeLookup = lookupServer;

            if (document.title) {
                const title = lookupServer(document.title);
                if (title !== null) { document.title = title; }
            }

            translateTree(document.body);
            observe();
            return;
        }

        document.documentElement.lang = "pt-BR";
        activeLookup = lookup;

        if (document.title) {
            const title = lookup(document.title);
            if (title !== null) { document.title = title; }
        }

        translateTree(document.body);
        observe();
    }

    /* the ENG / PT buttons: remember the choice and redraw the page in it */
    window.currentLanguage = currentLanguage;

    window.setLanguage = function (lang) {
        try { localStorage.setItem(LANG_KEY, lang === "en" ? "en" : "pt"); }
        catch (e) {}
        location.reload();
    };

    /* exposed for code that wants to translate a string directly */
    window.t = function (text) {
        const out = (activeLookup || lookup)(text);
        return out === null ? text : out;
    };
    window.PT = DICT;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
