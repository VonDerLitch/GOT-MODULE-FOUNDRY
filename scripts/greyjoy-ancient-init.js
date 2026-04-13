/**
 * Grey King Initialization - Iron Islands Legend (Era dos Heróis)
 * V3 "Clean" Pattern - Nautical mastery and mythical ancestry.
 */

async function initializeGreyKingAncient() {
    const eraName = "Lenda do Rei Cinzento (Ilhas de Ferro)";
    const eraColor = "#333333"; // Cinza Ferro

    const seaContent = {
        name: "Linhagem do Rei Cinzento",
        history: `
            <h2>O Rei Cinzento e Nagga</h2>
            <p>De acordo com a lenda, o <strong>Rei Cinzento</strong> governou as Ilhas de Ferro por mil anos. Sua maior façanha foi derrotar <strong>Nagga</strong>, a primeira dragoa marinha, transformando seus ossos no teto de seu grande salão.</p>
            <p>Ele tomou uma sereia como esposa para que seus filhos pudessem viver tanto na terra quanto na água, dando origem à cultura dos Homens de Ferro.</p>
            <p><strong>Cuidado:</strong> Dizem que o mar flui em suas veias e o sal endurece suas almas.</p>
        `,
        characters: [
            {
                name: "O Rei Cinzento",
                info: { idade: 1000, genero: "Masculino", casa: "Ilhas de Ferro", pontos_destino: 7 },
                biografia: "O soberano mítico que ensinou os homens a dominar as redes e as velas. Ele governa do Trono de Madeira Flutuante, tendo o fogo de Nagga para aquecer seu salão.",
                habilidades: {
                    vontade: { base: 7, especialidades: { dedicacao: 6, coragem: 7 } },
                    status: { base: 6, especialidades: { reputacao: 7, linhagem: 6 } },
                    guerra: { base: 6, especialidades: { comando: 6, tatica: 5 } },
                    atletismo: { base: 5, especialidades: { nadar: 7 } },
                    persuasao: { base: 5, especialidades: { intimidacao: 6 } }
                }
            },
            {
                name: "A Rainha Sereia",
                info: { idade: 200, genero: "Feminino", casa: "Profundezas", pontos_destino: 5 },
                biografia: "Esposa do Rei Cinzento, cujas canções atraíam krakens para a superfície. Ela concedeu a seus filhos a habilidade de nunca se cansarem no mar.",
                habilidades: {
                    atletismo: { base: 6, especialidades: { nadar: 8 } },
                    persuasao: { base: 6, especialidades: { encantar: 7 } },
                    conhecimento: { base: 5, especialidades: { lendas: 6, cura: 5 } },
                    percepcao: { base: 5, especialidades: { empatia: 5 } }
                }
            },
            {
                name: "Príncipe das Ondas (Híbrido)",
                info: { idade: 35, genero: "Masculino", casa: "Nascidos do Ferro", pontos_destino: 3 },
                biografia: "Um dos cem filhos do Rei Cinzento. Ele lidera as frotas contra os dragões marinhos e krakens, possuindo uma força sobre-humana e pulmões resistentes.",
                habilidades: {
                    luta: { base: 6, especialidades: { machados: 6, briga: 5 } },
                    atletismo: { base: 6, especialidades: { nadar: 6, forca: 6, vigor: 5 } },
                    lida_com_animais: { base: 5, especialidades: { treinamento: 6 } }, // Treinando krakens
                    resistencia: { base: 6, especialidades: { vigor: 5 } }
                }
            },
            {
                name: "Primeiro Capitão 'Nascido do Sal'",
                info: { idade: 40, genero: "Masculino", casa: "Nascidos do Ferro", pontos_destino: 2 },
                biografia: "O primeiro homem a jurar fidelidade ao Trono de Madeira Flutuante. Um mestre da navegação em tempestades impossíveis.",
                habilidades: {
                    conhecimento: { base: 5, especialidades: { navegacao: 7, geografia: 4 } },
                    atletismo: { base: 5, especialidades: { nadar: 5, forca: 5 } },
                    percepcao: { base: 5, especialidades: { visao: 6 } },
                    vontade: { base: 5, especialidades: { coragem: 5 } }
                }
            }
        ]
    };

    console.log("Iniciando Criação do Rei Cinzento (V3)...");

    // 1. Root Folder
    let eraFolder = game.folders.find(f => f.name === eraName && f.type === "Actor");
    if (!eraFolder) eraFolder = await Folder.create({ name: eraName, type: "Actor", color: eraColor });

    // 2. House Folder
    let houseFolder = game.folders.find(f => f.name === seaContent.name && f.folder === eraFolder.id);
    if (!houseFolder) houseFolder = await Folder.create({ name: seaContent.name, type: "Actor", folder: eraFolder.id });

    // 3. Journal Entry
    let journalFolder = game.folders.find(f => f.name === "Crônicas Orientais" && f.type === "JournalEntry");
    if (!journalFolder) journalFolder = await Folder.create({ name: "Crônicas Orientais", type: "JournalEntry" });

    let existingJournal = game.journal.find(j => j.name === "Lendas das Ilhas de Ferro" && j.folder === journalFolder.id);
    if (!existingJournal) {
        await JournalEntry.create({
            name: "Lendas das Ilhas de Ferro",
            folder: journalFolder.id,
            pages: [{
                name: "O Rei Cinzento e a Sereia",
                type: "text",
                text: { content: seaContent.history, format: 1 }
            }]
        });
    }

    // 4. Create Characters
    for (const char of seaContent.characters) {
        let existing = game.actors.find(a => a.name === char.name && a.folder === houseFolder.id);
        if (existing) continue;

        await Actor.create({
            name: char.name,
            type: "character",
            folder: houseFolder.id,
            system: {
                info: char.info,
                biografia: char.biografia,
                habilidades: char.habilidades,
                tipo_ficha: "character"
            }
        });
        console.log(`Criado: ${char.name}`);
    }

    ui.notifications.info("🌊 A era do Rei Cinzento foi inicializada!");
}

initializeGreyKingAncient();
