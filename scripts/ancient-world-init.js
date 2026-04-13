/**
 * GoT Ancient World Initializer (v8 - MASTER EDITION)
 * All content restored: Intro, Valyria, Ghis, Yi Ti, Wall, First Men, Andals, and Cities.
 * Structure: Era Folders -> House/City Folders -> Characters/Lore + Journals
 */

async function initializeAncientWorld() {
    const eraSuffix = " [Antigo]";

    const eras = [
        {
            name: "Introdução da Campanha",
            color: "#ffd700",
            houses: [
                {
                    name: "Introdução: O Despertar do Mundo",
                    history: `<h1>O Amanhecer de Ouro e Ferro</h1>
                        <p><strong>Ano:</strong> Aproximadamente 5.000 Antes da Conquista (V.C.)</p>
                        <hr>
                        <p>O mundo que vocês conhecem ainda não nasceu. Não há Trono de Ferro, não há Sete Reinos unificados, e as lendas que vocês ouviram são, nesta era, a mais pura e brutal realidade.</p>
                        
                        <h3>Em Essos: O Rugido de Valíria</h3>
                        <p>Nas profundezas das Quatorze Chamas, o fogo finalmente encontrou voz. Os pastores valirianos dominaram os dragões e agora o céu pertence a eles. O **Império Ghiscari**, a mais antiga civilização do mundo, arde sob as asas das Quarenta Famílias Nobres. Rios de escravos e montanhas de ouro fluem para o porto de Valíria, enquanto o mundo treme diante dos senhores dos céus.</p>
                        
                        <h3>Em Westeros: O Bronze contra o Ferro</h3>
                        <p>Enquanto isso, do outro lado do Mar Estreito, o povo dos **Primeiros Homens** governa uma terra de florestas densas e Represeiros profundos. Mas a paz é uma lembrança distante. Fugindo da expansão valiriana e guiados pela Fé dos Sete, as primeiras naves de aço dos **Ândalos** começaram a desembarcar no Vale.</p>
                        <p>A magia dos Filhos da Floresta e o bronze dos Reis Antigos estão prestes a colidir com o ferro e o fanatismo dos invasores. Vocês estão no epicentro de uma era de transição. Uma era onde o sangue de dragão é novo, o aço é raro e os deuses ainda caminham entre os homens.</p>
                        
                        <p><em>"O que é forjado no fogo hoje, será a lenda de amanhã."</em></p>`,
                    characters: []
                }
            ]
        },
        {
            name: "O Império de Antiga Ghis",
            color: "#b22222",
            houses: [
                {
                    name: "Dinastia Grazdan",
                    history: `<h2>A Linhagem do Fundador</h2>
                        <p>Descendentes diretos de Grazdan o Grande, os governantes de Ghis veem a si mesmos como os únicos guardiões legítimos da civilização. Eles desprezam os valirianos como "pastores de dragões" sem cultura.</p>
                        <p><strong>Status em 5.000 A.C.:</strong> O Império está em guerra aberta. A Dinastia Grazdan financia as legiões e coordena a defesa das pirâmides contra os ataques aéreos de Valíria.</p>`,
                    characters: [
                        { name: "Grazdan IV", bio: "O Grande Mestre de Ghis, um estrategista implacável que jurou ver as Quatorze Chamas extintas." },
                        { name: "Sacerdotisa Zhakani", bio: "Guardiã do Templo das Graças, que realiza ritos de sangue para buscar proteção contra o fogo dos dragões." }
                    ]
                },
                {
                    name: "Legiões de Passo Travado",
                    history: `<h2>As Legiões de Ghis: O Muralha de Escudos</h2>
                        <p>A força militar mais disciplinada do mundo antigo. Organizados em linhas cerradas e equipados com lanças e escudos maciços, os legionários são o orgulho do império.</p>`,
                    characters: [
                        { name: "Comandante Maez", bio: "Líder da Legião Gigante, famoso por ter derrubado um dragão menor com uma saraivada de escorpiões em Ghiscar." }
                    ]
                }
            ]
        },
        {
            name: "O Império Dourado de Yi Ti",
            color: "#ffd700",
            houses: [
                {
                    name: "Dinastia dos Imperadores Cinzentos",
                    history: `<h2>Yi Ti: O Império do Sol e da Lua</h2>
                        <p>Localizado no Extremo Oriente, Yi Ti é a civilização mais antiga e avançada do mundo conhecido. Suas cidades são maiores que qualquer outra em Essos, e seus imperadores reinam com o mandato dos deuses.</p>
                        <p><strong>Status em 5.000 A.C.:</strong> O Império Dourado está em sua era de ouro. Enquanto Valíria ainda está aprendendo a forjar estradas, os arquitetos de Yi Ti já construíram as Cinco Fortalezas para proteger o reino contra os demônios do leste.</p>`,
                    characters: [
                        { name: "Imperador-Deus Grisalho", bio: "O soberano absoluto que governa a partir da cidade de Yin, cercado por mil concubinas e guardas de elite." },
                        { name: "Príncipe de Jade", bio: "Herdeiro do trono e mestre das frotas que patrulham o Mar de Jade." }
                    ]
                },
                {
                    name: "Cidade de Yin",
                    history: `<h2>Yin: A Joia do Oriente</h2>
                        <p>A capital de Yi Ti, uma metrópole de pagodes dourados e jardins flutuantes. Suas muralhas são tão largas que dez carruagens podem andar lado a lado no topo.</p>`,
                    characters: []
                }
            ]
        },
        {
            name: "Domínio Valiriano",
            color: "#8b0000",
            houses: [
                {
                    name: "Casa Belaerys",
                    history: `<h2>Casa Belaerys: Os Senhores do Fogo</h2><p>Poderosos dragonlords que exploraram o mundo montados em feras colossais antes da Perdição.</p>`,
                    characters: [
                        { name: "Jaenara Belaerys", bio: "Exploradora lendária que voou sobre Sothoryos por anos montada em seu dragão Terrax." },
                        { name: "Belaer de Valíria", bio: "Um dos patriarcas da família durante o auge da expansão valiriana." }
                    ]
                },
                {
                    name: "Casa Targaryen",
                    history: `<h2>Casa Targaryen: Senhores de Dragonstone</h2><p>Uma linhagem menor de senhores de dragões que buscou refúgio no Mar Estreito.</p>`,
                    characters: [
                        { name: "Aenar Targaryen", bio: "Conhecido como o Exilado, o patriarca que levou sua família para Pedra do Dragão após as visões de sua filha." },
                        { name: "Daenys a Visionária", bio: "Cujas visões da Perdição de Valíria salvaram sua casa da aniquilação total." }
                    ]
                },
                {
                    name: "Casa Velaryon",
                    history: `<h2>Casa Velaryon: Os Senhores das Marés</h2><p>Uma casa valiriana de marinheiros e comerciantes que se estabeleceram em Derivamarca antes da Perdição.</p>`,
                    characters: [
                        { name: "Corlys Velaryon (Ancestral)", bio: "Capitão mercante que estabeleceu as rotas entre Valíria e o Mar Estreito." }
                    ]
                }
            ]
        },
        {
            name: "Reis dos Primeiros Homens",
            color: "#228b22",
            houses: [
                {
                    name: "Casa Mudd",
                    history: `<h2>Casa Mudd: Reis do Rio e da Colina</h2><p>A linhagem que unificou as terras do rio por gerações a partir de Pedravelha.</p>`,
                    characters: [
                        { name: "Tristifer IV Mudd", bio: "O Martelo de Justiça. Venceu 99 batalhas contra os invasores Ândalos, caindo apenas na centésima." },
                        { name: "Tristifer V Mudd", bio: "O último rei Mudd, sob cujo reinado a dinastia foi finalmente deprimida pelos Ândalos." }
                    ]
                },
                {
                    name: "Casa Royce",
                    history: `<h2>Casa Royce: Os Reis de Bronze</h2><p>Soberanos do Vale que resistiram aos invasores com armaduras cobertas de runas mágicas.</p>`,
                    characters: [
                        { name: "Yorwyck VI Royce", bio: "Liderou as forças de Pedrarruna contra as ondas de invasores que vinham pelo mar." },
                        { name: "Robar II Royce", bio: "O último herói dos Primeiros Homens no Vale, derrotado em combate pelo Cavaleiro Alado." }
                    ]
                },
                {
                    name: "Casa Gardener",
                    history: `<h2>Casa Gardener: Reis da Campina</h2><p>A linhagem lendária que governou Highgarden a partir do sangue de Garth Greenhand.</p>`,
                    characters: [
                        { name: "Garth IX Gardener", bio: "Um rei benevolente que expandiu as artes e a cavalaria primitiva na Campina." }
                    ]
                }
            ]
        },
        {
            name: "Invasores Ândalos",
            color: "#4682b4",
            houses: [
                {
                    name: "Casa Arryn",
                    history: `<h2>Casa Arryn: Os Senhores do Ar</h2><p>A primeira grande linhagem Ândala a conquistar e manter um reino em Westeros.</p>`,
                    characters: [
                        { name: "Ser Artys Arryn", bio: "O Cavaleiro Alado. O lendário fundador que conquistou o Vale e a Montanha." },
                        { name: "Roland I Arryn", bio: "O primeiro rei a iniciar a construção da colossal Eyrie nas nuvens." }
                    ]
                },
                {
                    name: "Casa Corbray",
                    history: `<h2>Casa Corbray: A Lâmina de Ferro</h2><p>Conquistadores ferozes que trouxeram o aço valiriano para as praias do Vale.</p>`,
                    characters: [
                        { name: "Corwyn Corbray", bio: "Wielder ancestral da Senhora Desespero durante a invasão do Vale." }
                    ]
                },
                {
                    name: "Casa Vance",
                    history: `<h2>Casa Vance: Os Colonos do Rio</h2><p>Estabeleceram a ordem Ândala nas Terras dos Rios após a queda dos Mudd.</p>`,
                    characters: [
                        { name: "Armistead Vance", bio: "O conquistador que derrotou Tristifer V Mudd na Batalha definitiva." }
                    ]
                }
            ]
        },
        {
            name: "Patrulha da Noite",
            color: "#000000",
            houses: [
                {
                    name: "A Ordem de Preto",
                    history: `<h2>A Patrulha da Noite: A Irmandade Juramentada</h2>
                        <p>Uma ordem que não deve lealdade a nenhum rei ou casa, composta por homens que entregaram suas fortunas e nomes para proteger o mundo dos vivos.</p>
                        <p><strong>Em 5.000 A.C.:</strong> A Patrulha é uma força de elite composta puramente pelo sangue dos **Primeiros Homens**. Como os Ândalos ainda não cruzaram o Gargalo para o Norte, a Patrulha mantém as tradições ancestrais e os costumes antigos.</p>`,
                    characters: [
                        { name: "Lorde Comandante Osric", bio: "Um veterano de um século, descendente direto dos Primeiros Homens, que mantém a disciplina de ferro no Fortenoite." },
                        { name: "Primeiro Patrulheiro Benjen (Ancestral)", bio: "Um rastreador cujas runas em sua pele dizem ter sido dadas pelos próprios Filhos da Floresta." }
                    ]
                }
            ]
        },
        {
            name: "Cidades e Fortalezas",
            color: "#696969",
            houses: [
                {
                    name: "Valíria",
                    history: `<h2>Valíria: A Capital das Quatorze Chamas</h2><p>Construída em mármore e fundida por sopro de dragão, ela é cercada pelos vulcões que deram origem ao seu poder.</p>`,
                    characters: []
                },
                {
                    name: "Antiga Ghis",
                    history: `<h2>Antiga Ghis: A Cidade das Pirâmides de Tijolo</h2><p>Localizada na Baía dos Escravos, é o coração de um império milenar em guerra contra Valíria.</p>`,
                    characters: []
                },
                {
                    name: "Pedravelha (Oldstones)",
                    history: `<h2>Pedravelha: O Trono de Bronze dos Mudd</h2><p>A capital da Casa Mudd no Tridente, no auge de sua resistência contra os Ândalos.</p>`,
                    characters: []
                },
                {
                    name: "A Muralha",
                    history: `<h2>A Muralha: O Escudo de Gelo da Humanidade</h2><p>Barreira colossal erguida por Brandon o Construtor, protegida por magias ancestrais.</p>`,
                    characters: []
                },
                {
                    name: "Jardim de Cima (Highgarden)",
                    history: `<h2>Jardim de Cima: O Berço da Campina</h2><p>Sede da Casa Gardener, centro de uma cultura vibrante e protegida pela paz de Garth Greenhand.</p>`,
                    characters: []
                }
            ]
        }
    ];

    // Execution Logic
    for (const era of eras) {
        const eraFolderName = era.name + eraSuffix;

        let eraActorFolder = game.folders.find(f => f.name === eraFolderName && f.type === "Actor");
        if (!eraActorFolder) eraActorFolder = await Folder.create({ name: eraFolderName, type: "Actor", color: era.color });

        let eraJournalFolder = game.folders.find(f => f.name === eraFolderName && f.type === "JournalEntry");
        if (!eraJournalFolder) eraJournalFolder = await Folder.create({ name: eraFolderName, type: "JournalEntry", color: era.color });

        for (const house of era.houses) {
            let houseActorFolder = game.folders.find(f => f.name === house.name && f.folder === eraActorFolder.id);
            if (!houseActorFolder) houseActorFolder = await Folder.create({ name: house.name, type: "Actor", folder: eraActorFolder.id });

            let houseJournalFolder = game.folders.find(f => f.name === house.name && f.folder === eraJournalFolder.id);
            if (!houseJournalFolder) houseJournalFolder = await Folder.create({ name: house.name, type: "JournalEntry", folder: eraJournalFolder.id });

            let journal = game.journal.find(j => j.name === house.name && j.folder === houseJournalFolder.id);
            if (!journal) {
                await JournalEntry.create({
                    name: house.name,
                    folder: houseJournalFolder.id,
                    pages: [{ name: "História e Contexto", type: "text", text: { content: house.history, format: 1 } }]
                });
            }

            for (const char of house.characters) {
                let actor = game.actors.find(a => a.name === char.name && a.folder === houseActorFolder.id);
                if (!actor) {
                    await Actor.create({
                        name: char.name,
                        type: "character",
                        folder: houseActorFolder.id,
                        "system.biografia": char.bio,
                        "system.tipo_ficha": "character"
                    });
                }
            }
        }
    }

    ui.notifications.info("Mundo Antigo (MASTER v8) inicializado com sucesso!");
}

initializeAncientWorld();
