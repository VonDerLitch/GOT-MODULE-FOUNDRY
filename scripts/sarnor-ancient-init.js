/**
 * Sarnor Initialization - The Tall Men (Era dos Heróis)
 * V3 "Clean" Pattern - Legendary stats and bronze-themed culture.
 */

async function initializeSarnorAncient() {
    const eraName = "Reino de Sarnor (Homens Altos)";
    const eraColor = "#cd7f32"; // Bronze

    const sarnorContent = {
        name: "Casa Real de Sarnath",
        history: `
            <h2>O Reino dos Homens Altos</h2>
            <p>Sarnor foi uma grande civilização de Essos, cujos habitantes eram conhecidos como <strong>Homens Altos</strong> devido à sua estatura imponente.</p>
            <p>Sua capital, <strong>Sarnath</strong>, era o lar do Palácio das Mil Salas, e seus exércitos eram temidos pelos carros de guerra com foices de bronze atrelados a cavalos fogosos.</p>
            <p><strong>Cultura:</strong> Valorizam a força física, a honra e o bronze. Suas cidades eram centros de comércio e arte antes da ascensão dos Dothraki.</p>
        `,
        characters: [
            {
                name: "Alto Rei Mazor Alexi",
                info: { idade: 55, genero: "Masculino", casa: "Sarnath", pontos_destino: 5 },
                biografia: "O Rei dos Reis, herdeiro de mil gerações. Mazor Alexi é um gigante entre homens, cujas vestes são bordadas com ouro e cujo cetro de bronze nunca fraquejou.",
                habilidades: {
                    status: { base: 7, especialidades: { gestao: 6, reputacao: 6, linhagem: 7 } },
                    vontade: { base: 6, especialidades: { coordenar: 5, dedicacao: 5 } },
                    guerra: { base: 6, especialidades: { comando: 6, estrategia: 6 } },
                    atletismo: { base: 5, especialidades: { forca: 4 } },
                    conhecimento: { base: 4, especialidades: { educacao: 4 } }
                }
            },
            {
                name: "General Tormo 'O Condutor de Bronze'",
                info: { idade: 40, genero: "Masculino", casa: "Sarnath", pontos_destino: 3 },
                biografia: "Mestre dos carros de guerra de Sarnor. Tormo lidera as quadrigas que massacraram inúmeras tribos nómades, suas rodas de bronze tingidas de sangue.",
                habilidades: {
                    guerra: { base: 6, especialidades: { tatica: 7, comando: 6 } },
                    lida_com_animais: { base: 6, especialidades: { treinamento: 6, cavalgar: 5 } },
                    atletismo: { base: 6, especialidades: { forca: 5 } },
                    luta: { base: 5, especialidades: { armas_de_haste: 5, machados: 4 } }
                }
            },
            {
                name: "Enyo, A Sacerdotisa de Bronze",
                info: { idade: 32, genero: "Feminino", casa: "Sarnath", pontos_destino: 4 },
                biografia: "Uma das filhas de Mazor e guardiã das tradições sagradas de Sarnath. Suas profecias são lidas nas chamas das forjas de bronze.",
                habilidades: {
                    conhecimento: { base: 6, especialidades: { pesquisa: 4, lendas: 6, curandeirismo: 4 } },
                    vontade: { base: 6, especialidades: { dedicacao: 6 } },
                    persuasao: { base: 5, especialidades: { encantar: 5 } },
                    percepcao: { base: 5, especialidades: { empatia: 4 } }
                }
            },
            {
                name: "Guerreiro Alto de Sarnath",
                info: { idade: 28, genero: "Masculino", casa: "Sarnath", pontos_destino: 0 },
                biografia: "Membro da guarda real de elite. Um espécime físico perfeito, treinado desde o nascimento para proteger o Palácio das Mil Salas.",
                habilidades: {
                    atletismo: { base: 6, especialidades: { forca: 6, vigor: 5 } },
                    resistencia: { base: 6, especialidades: { vigor: 5 } },
                    luta: { base: 6, especialidades: { armas_de_haste: 6, escudos: 4 } },
                    guerra: { base: 4, especialidades: { tatica: 3 } }
                }
            },
            {
                name: "Princesa Xanda 'A Arqueira de Marfim'",
                info: { idade: 24, genero: "Feminino", casa: "Sarnath", pontos_destino: 4 },
                biografia: "Uma das filhas do Alto Rei, famosa por sua pontaria infalível. Ela usa um arco de marfim de mamute que exige uma força que poucos homens possuem.",
                habilidades: {
                    pontaria: { base: 6, especialidades: { arcos: 6, pontaria_longa: 5 } },
                    agilidade: { base: 5, especialidades: { esquiva: 5, equilíbrio: 4 } },
                    atletismo: { base: 5, especialidades: { forca: 3 } },
                    status: { base: 4, especialidades: { reputação: 5 } }
                }
            },
            {
                name: "Senhor de Oros 'O Construtor'",
                info: { idade: 48, genero: "Masculino", casa: "Sarnath", pontos_destino: 3 },
                biografia: "Mestre das obras de Sarnath e Oros. Ele é o responsável por manter as muralhas de bronze e os canais de irrigação que sustentam o império.",
                habilidades: {
                    conhecimento: { base: 6, especialidades: { educacao: 4, engenharia: 6, pesquisa: 4 } },
                    status: { base: 5, especialidades: { gestao: 6, reputacao: 4 } },
                    vontade: { base: 5, especialidades: { coordenar: 5 } },
                    percepcao: { base: 4, especialidades: { visao: 4 } }
                }
            },
            {
                name: "General de Vanguarda 'Hulko, O Quebra-Falanges'",
                info: { idade: 35, genero: "Masculino", casa: "Sarnath", pontos_destino: 2 },
                biografia: "Um bruto sarniano que lidera a infantaria pesada. Conhecido por atravessar as fileiras inimigas como um touro, usando uma clava de bronze maciça.",
                habilidades: {
                    atletismo: { base: 7, especialidades: { forca: 7, vigor: 5 } },
                    luta: { base: 6, especialidades: { machados: 6, desarmado: 5 } },
                    guerra: { base: 6, especialidades: { comando: 5, tatica: 4 } },
                    resistencia: { base: 5, especialidades: { vigor: 6 } }
                }
            },
            {
                name: "Capitão da Guarda Terrestre",
                info: { idade: 30, genero: "Masculino", casa: "Sarnath", pontos_destino: 1 },
                biografia: "Oficial responsável pela defesa interna do Palácio. Especialista em técnicas defensivas e manutenção da ordem.",
                habilidades: {
                    luta: { base: 6, especialidades: { escudos: 6, laminas_curtas: 4 } },
                    guerra: { base: 5, especialidades: { tatica: 5, comando: 4 } },
                    conhecimento: { base: 4, especialidades: { lei: 5 } },
                    vontade: { base: 5, especialidades: { coragem: 4 } }
                }
            }
        ]
    };

    console.log("Iniciando Criação de Sarnor (V3)...");

    // 1. Root Folder
    let eraFolder = game.folders.find(f => f.name === eraName && f.type === "Actor");
    if (!eraFolder) eraFolder = await Folder.create({ name: eraName, type: "Actor", color: eraColor });

    // 2. House/Location Folder
    let houseFolder = game.folders.find(f => f.name === sarnorContent.name && f.folder === eraFolder.id);
    if (!houseFolder) houseFolder = await Folder.create({ name: sarnorContent.name, type: "Actor", folder: eraFolder.id });

    // 3. Journal Entry for Context
    let journalFolder = game.folders.find(f => f.name === "Crônicas Orientais" && f.type === "JournalEntry");
    if (!journalFolder) journalFolder = await Folder.create({ name: "Crônicas Orientais", type: "JournalEntry" });

    let existingJournal = game.journal.find(j => j.name === "Reino de Sarnor" && j.folder === journalFolder.id);
    if (!existingJournal) {
        await JournalEntry.create({
            name: "Reino de Sarnor",
            folder: journalFolder.id,
            pages: [{
                name: "O Império dos Homens Altos",
                type: "text",
                text: { content: sarnorContent.history, format: 1 }
            }]
        });
    }

    // 4. Create Characters
    for (const char of sarnorContent.characters) {
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
        console.log(`Criado: ${char.name} (Pasta: ${sarnorContent.name})`);
    }

    ui.notifications.info("文明 Reino de Sarnor (Homens Altos) criada com sucesso!");
}

// Inicia o processo
initializeSarnorAncient();
