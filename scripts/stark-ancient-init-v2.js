/**
 * GoT House Stark & Northern Vassals - V2 (Robust Edition)
 * Initializes legendary characters with full SIFRP stats, global items, 
 * and integrates into the Ancient World hierarchy.
 */

async function initializeStarkAncientV2() {
    const eraSuffix = " [Antigo]";
    const eraName = "Reis dos Primeiros Homens" + eraSuffix;
    const eraColor = "#228b22";

    // 1. Global Benefits (Qualities)
    const qualitiesToCreate = [
        { name: "Sangue dos Primeiros Homens", type: "qualidade", desc: "Força e resistência sobrenaturais. +2 de Saúde e +1B em testes de Vontade." },
        { name: "Mestre de Winterfell", type: "qualidade", desc: "Pode comandar o Norte com autoridade absoluta. +1D em Guerra (Comando) no Norte." },
        { name: "Fiel ao Lobo", type: "qualidade", desc: "Lealdade inabalável. Ignora penalidades de moral em combate ao lutar pelos Stark." },
        { name: "Força Gigante", type: "qualidade", desc: "Dano massivo com armas de impacto e mãos nuas. +2 de dano base." },
        { name: "Pele de Urso", type: "qualidade", desc: "Resistência natural ao frio e golpes. AR 2 natural (não conta como armadura)." },
        { name: "Guerreiro do Inverno", type: "qualidade", desc: "Ignora penalidades de terreno e visibilidade causadas por neve ou gelo." }
    ];

    ui.notifications.info("Sincronizando Benefícios Globais...");
    const qualityMap = {};
    for (const q of qualitiesToCreate) {
        let existingItem = game.items.find(i => i.name === q.name && i.type === q.type);
        if (!existingItem) {
            existingItem = await Item.create({
                name: q.name,
                type: q.type,
                img: "icons/svg/shield.svg",
                system: { type: q.type, description: `<p>${q.desc}</p>` }
            });
        }
        qualityMap[q.name] = existingItem;
    }

    // 2. Data Definition
    const northContent = {
        houses: [
            {
                name: "Casa Stark",
                history: `<h2>Casa Stark: Reis do Inverno</h2>
                    <p>Dominam o Norte a partir de Winterfell. Sua linhagem é a mais pura dos Primeiros Homens.</p>`,
                characters: [
                    {
                        name: "Brandon o Construtor",
                        info: { idade: 60, genero: "Masculino", casa: "Casa Stark", pontos_destino: 5 },
                        biografia: "O Arquiteto de Eras. Fundador da Muralha e de Winterfell.",
                        habilidades: {
                            conhecimento: { base: 6, especialidades: { educacao: 4, pesquisa: 5 } },
                            vontade: { base: 6, especialidades: { coordenar: 5, dedicacao: 4 } },
                            status: { base: 7, especialidades: { linhagem: 5, gestao: 6 } },
                            guerra: { base: 5, especialidades: { estrategia: 4 } }
                        },
                        benefits: ["Sangue dos Primeiros Homens", "Mestre de Winterfell"]
                    },
                    {
                        name: "Theon Stark",
                        info: { idade: 35, genero: "Masculino", casa: "Casa Stark", pontos_destino: 3 },
                        biografia: "O Lobo Faminto. Um guerreiro incansável que unificou o Norte pelo bronze e sangue.",
                        habilidades: {
                            luta: { base: 6, especialidades: { laminas_longas: 5, escudos: 3 } },
                            guerra: { base: 6, especialidades: { comando: 5, tatica: 4 } },
                            atletismo: { base: 5, especialidades: { forca: 3 } },
                            vontade: { base: 5, especialidades: { coragem: 4 } }
                        },
                        benefits: ["Sangue dos Primeiros Homens", "Guerreiro do Inverno"]
                    },
                    {
                        name: "Rickard Stark 'O Lobo de Ferro'",
                        info: { idade: 28, genero: "Masculino", casa: "Casa Stark", pontos_destino: 4 },
                        biografia: "General das forças de vanguarda. Sua armadura de bronze é coberta por runas de proteção.",
                        habilidades: {
                            guerra: { base: 6, especialidades: { comando: 5, tatica: 5, estratégia: 4 } },
                            luta: { base: 5, especialidades: { machados: 4 } },
                            atletismo: { base: 4 },
                            vontade: { base: 4 }
                        },
                        benefits: ["Sangue dos Primeiros Homens", "Fiel ao Lobo"]
                    }
                ]
            },
            {
                name: "Casa Umber",
                history: `<h2>Casa Umber: Sentinelas do Norte</h2>
                    <p>Protetores da Última Lareira e aliados dos gigantes.</p>`,
                characters: [
                    {
                        name: "General 'Esmaga-Montanhas'",
                        info: { idade: 120, genero: "N/A", casa: "Casa Umber (Gigante)", pontos_destino: 0 },
                        biografia: "Um general gigante de força colossal. Seus passos tremem o chão.",
                        habilidades: {
                            atletismo: { base: 7, especialidades: { forca: 6 } },
                            resistencia: { base: 7, especialidades: { resiliencia: 5, vigor: 5 } },
                            luta: { base: 6, especialidades: { desarmado: 6, macas: 4 } },
                            vontade: { base: 5 }
                        },
                        benefits: ["Força Gigante", "Sangue dos Primeiros Homens"]
                    },
                    {
                        name: "Jon Umber 'O Gigante'",
                        info: { idade: 50, genero: "Masculino", casa: "Casa Umber", pontos_destino: 1 },
                        biografia: "O General Humano que coordena os ataques conjuntos entre homens e gigantes.",
                        habilidades: {
                            guerra: { base: 6, especialidades: { comando: 6, tatica: 4 } },
                            atletismo: { base: 6, especialidades: { forca: 5 } },
                            luta: { base: 5, especialidades: { macas: 4 } },
                            resistencia: { base: 5 }
                        },
                        benefits: ["Sangue dos Primeiros Homens"]
                    }
                ]
            },
            {
                name: "Casa Mormont",
                history: `<h2>Casa Mormont: A Garra da Ilha dos Ursos</h2>
                    <p>Guerreiros isolados e ferozes do Mar do Poente.</p>`,
                characters: [
                    {
                        name: "Jorym Mormont",
                        info: { idade: 40, genero: "Masculino", casa: "Casa Mormont", pontos_destino: 2 },
                        biografia: "Lendário senhor da ilha, senhor dos ursos.",
                        habilidades: {
                            luta: { base: 6, especialidades: { machados: 5 } },
                            resistencia: { base: 5, especialidades: { resiliencia: 4 } },
                            sobrevivencia: { base: 6, especialidades: { orientacao: 3, forragear: 3 } },
                            atletismo: { base: 5 }
                        },
                        benefits: ["Pele de Urso", "Fiel ao Lobo"]
                    },
                    {
                        name: "Maege Mormont 'A Garra'",
                        info: { idade: 38, genero: "Feminino", casa: "Casa Mormont", pontos_destino: 2 },
                        biografia: "General das mulheres guerreiras da Ilha dos Ursos. Tão feroz quanto uma ursa protegendo a cria.",
                        habilidades: {
                            guerra: { base: 5, especialidades: { comando: 4, tatica: 4 } },
                            luta: { base: 6, especialidades: { machados: 4, escudos: 3 } },
                            atletismo: { base: 4 },
                            agilidade: { base: 4 }
                        },
                        benefits: ["Pele de Urso", "Fiel ao Lobo"]
                    }
                ]
            },
            {
                name: "Casa Bolton",
                history: `<h2>Casa Bolton: Os Reis Vermelhos</h2>
                    <p>Subjugados mas ainda perigosos. Mestres da guerra psicológica.</p>`,
                characters: [
                    {
                        name: "Rogar o Caçador",
                        info: { idade: 42, genero: "Masculino", casa: "Casa Bolton", pontos_destino: 1 },
                        biografia: "Um Bolton implacável conhecido por sua perícia com lâminas de bronze.",
                        habilidades: {
                            luta: { base: 5, especialidades: { laminas_curtas: 4 } },
                            furtividade: { base: 6, especialidades: { emboscada: 4 } },
                            astucia: { base: 5 },
                            percepcao: { base: 4 }
                        },
                        benefits: ["Guerreiro do Inverno"]
                    },
                    {
                        name: "Helman Bolton 'O Esfolador'",
                        info: { idade: 45, genero: "Masculino", casa: "Casa Bolton", pontos_destino: 0 },
                        biografia: "General dos exércitos do Forte do Pavor. Especialista em guerra de cerco e medo.",
                        habilidades: {
                            guerra: { base: 6, especialidades: { comando: 5, tatica: 5, estrategia: 5 } },
                            intrigas: { base: 4 },
                            vontade: { base: 4 },
                            luta: { base: 4 }
                        },
                        benefits: ["Sangue dos Primeiros Homens"]
                    }
                ]
            }
        ]
    };

    // 3. Folder & Journal Integration
    let eraActorFolder = game.folders.find(f => f.name === eraName && f.type === "Actor");
    if (!eraActorFolder) eraActorFolder = await Folder.create({ name: eraName, type: "Actor", color: eraColor });

    let eraJournalFolder = game.folders.find(f => f.name === eraName && f.type === "JournalEntry");
    if (!eraJournalFolder) eraJournalFolder = await Folder.create({ name: eraName, type: "JournalEntry", color: eraColor });

    for (const house of northContent.houses) {
        let houseActorFolder = game.folders.find(f => f.name === house.name && f.folder === eraActorFolder.id);
        if (!houseActorFolder) houseActorFolder = await Folder.create({ name: house.name, type: "Actor", folder: eraActorFolder.id });

        let houseJournalFolder = game.folders.find(f => f.name === house.name && f.folder === eraJournalFolder.id);
        if (!houseJournalFolder) houseJournalFolder = await Folder.create({ name: house.name, type: "JournalEntry", folder: eraJournalFolder.id });

        // Journal
        let journal = game.journal.find(j => j.name === house.name && j.folder === houseJournalFolder.id);
        if (!journal) {
            await JournalEntry.create({
                name: house.name,
                folder: houseJournalFolder.id,
                pages: [{ name: "Lendas do Norte", type: "text", text: { content: house.history, format: 1 } }]
            });
        }

        // Actors
        for (const charData of house.characters) {
            let existingActor = game.actors.find(a => a.name === charData.name && a.folder === houseActorFolder.id);
            if (!existingActor) {
                const actor = await Actor.create({
                    name: charData.name,
                    type: "character",
                    folder: houseActorFolder.id,
                    system: {
                        info: charData.info,
                        biografia: charData.biografia,
                        habilidades: charData.habilidades,
                        tipo_ficha: "character"
                    }
                });

                // Link Benefits
                if (charData.benefits) {
                    const itemsToLink = charData.benefits.map(name => {
                        const globalItem = qualityMap[name];
                        return globalItem ? globalItem.toObject() : null;
                    }).filter(i => i);
                    await actor.createEmbeddedDocuments("Item", itemsToLink);
                }
            }
        }
    }

    ui.notifications.info("Inverno Chegou! Norte robusto inicializado.");
}

initializeStarkAncientV2();
