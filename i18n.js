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
        "ENTER GALACTIC FRONT": "ENTRAR NO GALACTIC FRONT",
        "CHOOSE YOUR FACTION": "ESCOLHA SUA FACÇÃO",
        "CHANGE FACTION": "MUDAR FACÇÃO",
        "YOUR FACTION": "SUA FACÇÃO",
        "Faction:": "Facção:",
        "FLEET COST": "CUSTO DE FROTA",
        "Fleet cost:": "Custo de frota:",
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
        "Party chosen.": "Partido escolhido.",
        "Vetoed.": "Vetado.",
        "Vote cast.": "Voto registrado.",
        "You are a candidate for President.": "Você é candidato à Presidência.",
        "Use your veto on this proposal? You can only veto once per term.":
            "Usar seu veto nesta proposta? Você só pode vetar uma vez por mandato.",
        "The Declaration of War is before Congress.": "A declaração de guerra está no Congresso.",
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
        "Fully integrated into the Authority.": "Totalmente integrado à Autoridade.",
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
        "war declared · blue = Authority, red = Combine, white = Independents":
            "guerra declarada · azul = Freedom Authority, vermelho = Combine, branco = Independents",
        "Ring colour = occupation stage (gold occupied, light blue civilian administration, violet protected, green integrated)":
            "Cor do anel = estágio de ocupação (dourado ocupado, azul-claro administração civil, violeta protegido, verde integrado)",

        /* ---------- the Combine's Supreme Soviet ---------- */
        "SUPREME SOVIET OF THE COMBINE": "SOVIETE SUPREMO DO COMBINE",
        "Supreme Soviet of the Combine": "Soviete Supremo do Combine",
        "SUPREME SOVIET": "SOVIETE SUPREMO",
        "THE PLENUM": "O PLENO",
        "SECRETARY": "SECRETÁRIO",
        "CONFIDENCE": "CONFIANÇA",
        "QUOTA": "COTA",
        "DIRECTIVES": "DIRETIVAS",
        "GENERAL SECRETARY": "SECRETÁRIO-GERAL",
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
        "General Secretary of the Combine": "Secretário-Geral do Combine",
        "Election of the General Secretary": "Eleição do Secretário-Geral",
        "The General Secretary may keep 5 directives before the Soviet (others 3), has used the veto of this term, and the ruling current's agenda is heard more often.":
            "O Secretário-Geral pode manter 5 diretivas no Soviete (os outros 3), já usou o veto deste mandato e a agenda da corrente no poder é ouvida com mais frequência.",
        "The General Secretary may keep 5 directives before the Soviet (others 3), may veto one directive per term, and the ruling current's agenda is heard more often.":
            "O Secretário-Geral pode manter 5 diretivas no Soviete (os outros 3), pode vetar uma diretiva por mandato e a agenda da corrente no poder é ouvida com mais frequência.",
        "Your current": "Sua corrente",
        "Every Combine player belongs to a current of the Party. You need one to stand for General Secretary or to vote.":
            "Todo jogador do Combine pertence a uma corrente do Partido. Você precisa de uma para se candidatar a Secretário-Geral ou votar.",
        "The next election starts when the term ends (in": "A próxima eleição começa quando o mandato terminar (em",
        "An election is called as soon as a Combine player is online.":
            "Uma eleição é convocada assim que um jogador do Combine estiver online.",
        "STAND FOR GENERAL SECRETARY": "CANDIDATAR-SE A SECRETÁRIO-GERAL",
        "Current chosen.": "Corrente escolhida.",
        "You are a candidate for General Secretary.": "Você é candidato a Secretário-Geral.",
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
        "Every world where the Combine holds at least one city. A world is whole only when no other faction holds a city there, and only a whole world pays into the plan; the rest still has to be taken, and a campaign needs the Soviet's approval.":
            "Todo mundo onde o Combine tem pelo menos uma cidade. Um mundo só é inteiro quando nenhuma outra facção tem cidade lá, e só um mundo inteiro paga ao plano; o resto ainda precisa ser tomado, e uma campanha precisa da aprovação do Soviete.",
        "The Combine holds no world yet. Take one with a military campaign (NEW DIRECTIVE), and it is listed here.":
            "O Combine ainda não tomou nenhum mundo. Tome um com uma campanha militar (NOVA DIRETIVA) e ele aparece aqui.",
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
        "the ring says how many of its cities are ours": "o anel diz quantas de suas cidades são nossas",
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

        /* ---------- page titles ---------- */
        "Galactic Front - Galaxy Map": "Galactic Front - Mapa da Galáxia",
        "Galactic Front - Planet": "Galactic Front - Planeta",
        "Galactic Wars - City Battle": "Galactic Wars - Batalha Urbana"
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
        ["Planet:", "Planeta:"]
    ];

    /* trailing words after a number: "176 DELEGATES", "12 VOTES" */
    const SUFFIX = [
        [" DELEGATES", " DELEGADOS"],
        [" SEATS", " CADEIRAS"],
        [" VOTES", " VOTOS"],
        [" CREDITS", " CRÉDITOS"],
        [" UNITS", " UNIDADES"],
        [" SOLDIERS", " SOLDADOS"]
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
        "O Secretário-Geral vetou esta diretiva.": "The General Secretary vetoed this directive.",
        "Uma nova frota foi autorizada: construa-a no mapa galáctico.":
            "A new fleet is authorised: build it from the galaxy map.",
        "Um destacamento blindado foi autorizado: recrute-o para uma frota (a cadeia da Instalação Knightmare ainda é necessária).":
            "An armoured detachment is authorised: recruit it into a fleet (the Knightmare Facility chain is still required).",
        "Plano de produção elevado: 300-500 créditos a cada 15 minutos por nível (máximo 2); o Partido perde confiança.":
            "Production quota raised: 300-500 credits every 15 minutes per level (max 2); the Party loses confidence.",
        "ELEIÇÃO: uma campanha para Secretário-Geral foi aberta. Entre em uma corrente do Partido, declare a candidatura (8 minutos) e então todos votam (8 minutos).":
            "ELECTION: a campaign for General Secretary is open. Join a current of the Party, declare your candidacy (8 minutes), then all players vote (8 minutes).",
        "ELEIÇÃO: a votação está aberta. Todo jogador do Combine que entrou em uma corrente pode votar.":
            "ELECTION: voting is open. Every Combine player who has joined a current may vote.",
        "ELEIÇÃO: ninguém se apresentou. O cargo continua vago.":
            "ELECTION: nobody stood. The office stays vacant.",
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
        [/^VETO: o Presidente (.*) veta "(.*)"\.$/, function (all, who, title) {
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
        [/^VETO: o Secretário-Geral (.*) veta "(.*)"\.$/, function (all, who, title) {
            return 'VETO: General Secretary ' + who + ' vetoes "' + (lookupServer(title) || title) + '".';
        }],
        [/^PLANO: ([0-9]+) créditos produzidos pelos mundos do Combine\.$/,
            "PLAN: $1 credits produced by the Combine's worlds."],
        [/^Eleito com ([0-9]+) voto\(s\)\.$/, "Elected with $1 vote(s)."],
        [/^Nenhum candidato\.$/, "No candidate."],
        [/^PARTIDO: (.+) entra em (Vanguarda Proletária|Aparato do Partido|Comando Vermelho)\.$/, function (all, who, current) {
            return who + ' joins ' + (lookupServer(current) || current) + '.';
        }],
        [/^CANDIDATURA: (.+) apresenta-se a Secretário-Geral\.$/,
            "CANDIDACY: $1 stands for General Secretary."],
        [/^ELEIÇÃO: (.*) é eleito Secretário-Geral do Combine \(([0-9]+) voto\(s\)\)\.$/,
            "ELECTION: $1 is elected General Secretary of the Combine ($2 vote(s))."],
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
        if (!raw || raw.length > 400) { return; }
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
