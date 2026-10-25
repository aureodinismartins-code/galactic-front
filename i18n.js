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
        "Status:": "Status:",
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
        "SELECT TO BRIBE DELEGATES": "SELECIONAR PARA SUBORNAR",
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
        "COST WHEN PASSED:": "CUSTO SE APROVADA:",
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

    function normalize(text) {
        let s = String(text);
        for (const k in ENTITIES) {
            if (s.indexOf(k) !== -1) { s = s.split(k).join(ENTITIES[k]); }
        }
        return s.replace(/\s+/g, " ").trim();
    }

    function lookup(raw) {
        const core = normalize(raw);
        if (!core || !/[A-Za-zÀ-ÿ]{2}/.test(core)) { return null; }
        if (PROTECTED.test(core)) { return null; }
        if (Object.prototype.hasOwnProperty.call(DICT, core)) { return DICT[core]; }

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

    function translateTextNode(node) {
        const raw = node.nodeValue;
        if (!raw || raw.length > 400) { return; }
        const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
        if (!m || !m[2]) { return; }
        const out = lookup(m[2]);
        if (out === null) { return; }
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
            const out = lookup(cur);
            if (out !== null) { el.setAttribute(a, out); }
        }

        if (tag === "INPUT" && (el.type === "button" || el.type === "submit" || el.type === "reset")) {
            const out = lookup(el.value);
            if (out !== null) { el.value = out; }
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


    function start() {

        markLanguageButtons();

        /* English: the pages are written in English, so nothing is replaced */
        if (currentLanguage() === "en") {
            document.documentElement.lang = "en";
            return;
        }

        document.documentElement.lang = "pt-BR";

        if (document.title) {
            const title = lookup(document.title);
            if (title !== null) { document.title = title; }
        }

        translateTree(document.body);

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

    /* the ENG / PT buttons: remember the choice and redraw the page in it */
    window.currentLanguage = currentLanguage;

    window.setLanguage = function (lang) {
        try { localStorage.setItem(LANG_KEY, lang === "en" ? "en" : "pt"); }
        catch (e) {}
        location.reload();
    };

    /* exposed for code that wants to translate a string directly */
    window.t = function (text) {
        const out = lookup(text);
        return out === null ? text : out;
    };
    window.PT = DICT;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();
