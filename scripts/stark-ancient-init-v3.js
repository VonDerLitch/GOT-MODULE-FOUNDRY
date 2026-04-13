/**
 * GoT House Stark & Northern Vassals - V3 (Clean & Direct)
 * Initializes legendary characters with full SIFRP stats.
 * Removed automated qualities for manual control as requested.
 */

async function initializeStarkAncientV3() {
    const eraName = "Norte: Era dos Heróis";
    const eraColor = "#228b22";

    const northContent = {
        houses: [
            {
                name: "Casa Stark",
                history: "<h2>Reis do Inverno</h2><p>Winterfell.</p>",
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
                        }
                    },
                    {
                        name: "Theon Stark",
                        info: { idade: 35, genero: "Masculino", casa: "Casa Stark", pontos_destino: 3 },
                        biografia: "O Lobo Faminto. Um rei guerreiro que unificou o Norte pelo bronze e sangue.",
                        habilidades: {
                            luta: { base: 6, especialidades: { laminas_longas: 5, escudos: 3 } },
                            guerra: { base: 6, especialidades: { comando: 5, tatica: 4 } },
                            atletismo: { base: 5, especialidades: { forca: 3 } },
                            vontade: { base: 5, especialidades: { coragem: 4 } }
                        }
                    },
                    {
                        name: "Rickard Stark 'O Lobo de Ferro'",
                        info: { idade: 28, genero: "Masculino", casa: "Casa Stark", pontos_destino: 4 },
                        biografia: "General das forças de vanguarda.",
                        habilidades: {
                            guerra: { base: 6, especialidades: { comando: 5, tatica: 5, estrategia: 4 } },
                            luta: { base: 5, especialidades: { machados: 4 } }
                        }
                    }
                ]
            },
            {
                name: "Casa Umber",
                history: "<h2>Guardas da Última Lareira</h2>",
                characters: [
                    {
                        name: "General 'Esmaga-Montanhas'",
                        info: { idade: 120, genero: "Gigante", casa: "Casa Umber", pontos_destino: 0 },
                        biografia: "General gigante de força colossal.",
                        habilidades: {
                            atletismo: { base: 7, especialidades: { forca: 6 } },
                            resistencia: { base: 7, especialidades: { resiliencia: 5, vigor: 5 } },
                            luta: { base: 6, especialidades: { desarmado: 6 } },
                            vontade: { base: 5 }
                        }
                    },
                    {
                        name: "Jon Umber 'O Gigante'",
                        info: { idade: 50, genero: "Masculino", casa: "Casa Umber", pontos_destino: 1 },
                        biografia: "General humano dos Umber.",
                        habilidades: {
                            guerra: { base: 6, especialidades: { comando: 6, tatica: 4 } },
                            atletismo: { base: 6, especialidades: { forca: 5 } }
                        }
                    }
                ]
            },
            {
                name: "Casa Mormont",
                history: "<h2>Ursos da Ilha</h2>",
                characters: [
                    {
                        name: "Jorym Mormont",
                        info: { idade: 40, genero: "Masculino", casa: "Casa Mormont", pontos_destino: 2 },
                        biografia: "Senhor da ilha.",
                        habilidades: {
                            luta: { base: 6, especialidades: { machados: 5 } },
                            sobrevivencia: { base: 6, especialidades: { orientacao: 3 } }
                        }
                    },
                    {
                        name: "Maege Mormont 'A Garra'",
                        info: { idade: 38, genero: "Feminino", casa: "Casa Mormont", pontos_destino: 2 },
                        biografia: "General das mulheres guerreiras.",
                        habilidades: {
                            guerra: { base: 5, especialidades: { comando: 4, tatica: 4 } },
                            luta: { base: 6, especialidades: { machados: 4 } }
                        }
                    }
                ]
            },
            {
                name: "Casa Bolton",
                history: "<h2>Reis Vermelhos</h2>",
                characters: [
                    {
                        name: "Helman Bolton 'O Esfolador'",
                        info: { idade: 45, genero: "Masculino", casa: "Casa Bolton", pontos_destino: 0 },
                        biografia: "General do Forte do Pavor.",
                        habilidades: {
                            guerra: { base: 6, especialidades: { comando: 5, tatica: 5, estrategia: 5 } },
                            furtividade: { base: 5 }
                        }
                    }
                ]
            }
        ]
    };

    console.log("Iniciando Criação do Norte (V3)...");

    // 1. Root Folder
    let eraFolder = game.folders.find(f => f.name === eraName && f.type === "Actor");
    if (!eraFolder) eraFolder = await Folder.create({ name: eraName, type: "Actor", color: eraColor });

    for (const house of northContent.houses) {
        // House Folder
        let houseFolder = game.folders.find(f => f.name === house.name && f.folder === eraFolder.id);
        if (!houseFolder) houseFolder = await Folder.create({ name: house.name, type: "Actor", folder: eraFolder.id });

        for (const char of house.characters) {
            // Check if already exists in this folder
            let existing = game.actors.find(a => a.name === char.name && a.folder === houseFolder.id);
            if (existing) {
                console.log(`Personagem já existe: ${char.name}`);
                continue;
            }

            const actor = await Actor.create({
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
            console.log(`Criado: ${char.name} (Pasta: ${house.name})`);
        }
    }

    ui.notifications.info("Personagens do Norte V3 (Sem Qualidades) criados com sucesso!");
}

initializeStarkAncientV3();
