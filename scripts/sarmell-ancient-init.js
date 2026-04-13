/**
 * Sar Mell Initialization - Rhoynar Civilization (Era dos Heróis)
 * V3 "Clean" Pattern - Legendary stats and cultural lore.
 */

async function initializeSarmellAncient() {
    const eraName = "Povo de Sar Mel (Roina)";
    const eraColor = "#0077be"; // Water Blue

    const sarmellContent = {
        name: "Sar Mel",
        history: `
            <h2>A Cidade das Flores e das Águas</h2>
            <p>Localizada às margens do baixo Roine, Sar Mel é famosa pelo seu <strong>Festival do Amor</strong>.</p>
            <p>Diferente das fortalezas austeras do Norte, suas torres são de mármore rosa e seus canais servem como estradas para os belos barcos coloridos.</p>
            <p><strong>Cultura:</strong> Os Roinares de Sar Mel valorizam a água, a música e a diplomacia. Suas mulheres lutam e governam em pé de igualdade com os homens.</p>
        `,
        characters: [
            {
                name: "Príncipe Garin 'O Grande'",
                info: { idade: 42, genero: "Masculino", casa: "Sar Mel", pontos_destino: 5 },
                biografia: "O orgulhoso soberano de Sar Mel. Um visionário que acredita na liberdade total dos Roina contra qualquer império.",
                habilidades: {
                    status: { base: 6, especialidades: { gestao: 4, reputacao: 5, torneios: 3 } },
                    persuasao: { base: 6, especialidades: { encantar: 5, convencer: 4 } },
                    guerra: { base: 6, especialidades: { comando: 6, estrategia: 5 } },
                    vontade: { base: 5, especialidades: { coragem: 4 } }
                }
            },
            {
                name: "Princesa Nyra de Sar Mel",
                info: { idade: 26, genero: "Feminino", casa: "Sar Mel", pontos_destino: 4 },
                biografia: "Irmã de Garin e mestre da diplomacia aquática. Ela viaja pelos canais em seu barco de cisne, tecendo alianças entre as cidades-estado do Roine.",
                habilidades: {
                    persuasao: { base: 6, especialidades: { seducao: 6, encantar: 5 } },
                    status: { base: 5, especialidades: { etiqueta: 5, linhagem: 4 } },
                    agilidade: { base: 5, especialidades: { danca: 6, esquiva: 4 } },
                    conhecimento: { base: 4, especialidades: { educacao: 4 } }
                }
            },
            {
                name: "General 'O Domador das Correntes'",
                info: { idade: 38, genero: "Masculino", casa: "Sar Mel", pontos_destino: 2 },
                biografia: "Comandante das frotas de guerra de Sar Mel. Especialista em usar o rio como arma, afogando invasores em armadilhas de correntes e redes.",
                habilidades: {
                    guerra: { base: 6, especialidades: { tatica: 6, comando: 5, guerra_naval: 6 } }, // Usando guerra_naval como especialidade custom
                    atletismo: { base: 6, especialidades: { nadar: 7, forca: 4 } },
                    luta: { base: 5, especialidades: { armas_de_haste: 5, redes: 6 } },
                    percepcao: { base: 4, especialidades: { empatia: 3 } }
                }
            },
            {
                name: "Sacerdote dos Cantos da Água",
                info: { idade: 55, genero: "Masculino", casa: "Sar Mel", pontos_destino: 3 },
                biografia: "Um sábio que entende os sussurros do Rio Roine. Dizem que suas preces podem acalmar as águas ou convocar os Grandes Quelônios (Tartarugas Gigantes).",
                habilidades: {
                    conhecimento: { base: 6, especialidades: { pesquisa: 5, lendas: 6 } },
                    vontade: { base: 6, especialidades: { dedicacao: 5 } },
                    cura: { base: 5, especialidades: { tratar_doenca: 5 } },
                    percepcao: { base: 5, especialidades: { visao: 4 } }
                }
            }
        ]
    };

    console.log("Iniciando Criação de Sar Mel (V3)...");

    // 1. Root Folder
    let eraFolder = game.folders.find(f => f.name === eraName && f.type === "Actor");
    if (!eraFolder) eraFolder = await Folder.create({ name: eraName, type: "Actor", color: eraColor });

    // 2. House/Location Folder
    let houseFolder = game.folders.find(f => f.name === sarmellContent.name && f.folder === eraFolder.id);
    if (!houseFolder) houseFolder = await Folder.create({ name: sarmellContent.name, type: "Actor", folder: eraFolder.id });

    // 3. Journal Entry for Context
    let journalFolder = game.folders.find(f => f.name === "Crônicas Roinas" && f.type === "JournalEntry");
    if (!journalFolder) journalFolder = await Folder.create({ name: "Crônicas Roinas", type: "JournalEntry" });

    let existingJournal = game.journal.find(j => j.name === "Sar Mel" && j.folder === journalFolder.id);
    if (!existingJournal) {
        await JournalEntry.create({
            name: "Sar Mel",
            folder: journalFolder.id,
            pages: [{
                name: "História e Cultura",
                type: "text",
                text: { content: sarmellContent.history, format: 1 }
            }]
        });
    }

    // 4. Create Characters
    for (const char of sarmellContent.characters) {
        let existing = game.actors.find(a => a.name === char.name && a.folder === houseFolder.id);
        if (existing) {
            console.log(`Personagem já existe: ${char.name}`);
            continue;
        }

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
        console.log(`Criado: ${char.name} (Pasta: ${sarmellContent.name})`);
    }

    ui.notifications.info("文明 Sar Mel (Roina) criada com sucesso!");
}

// Inicia o processo
initializeSarmellAncient();
