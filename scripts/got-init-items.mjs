Hooks.once('ready', async function () {
    // Only run this if the user is a GM
    if (!game.user.isGM) return;

    const packLabel = "Qualidades (Gelo e Fogo)";
    const packName = "got-qualidades";

    // Check if the pack already exists in the world
    let pack = game.packs.get(`world.${packName}`);

    if (!pack) {
        ui.notifications.info("Criando Compêndio de Qualidades de Game of Thrones...");

        // Create the Compendium
        pack = await CompendiumCollection.createCompendium({
            type: "Item",
            label: packLabel,
            name: packName,
            package: "world"
        });

        const qualities = [
            { name: "Aclimatado", desc: "Você ignora penalidades de clima extremo." },
            { name: "Ágil", desc: "Você ganha +1B em Testes de Agilidade." },
            { name: "Ambicioso", desc: "Você ganha bônus em testes de Intriga quando há algo a ganhar." },
            { name: "Amigo dos Animais", desc: "Animais domésticos e selvagens tendem a gostar de você." },
            { name: "Aparência Agradável", desc: "Você ganha +1B em testes de Seduzir e Encantar." },
            { name: "Artista", desc: "Você é mestre em uma forma de arte específica." },
            { name: "Atleta", desc: "Você ganha +1B em testes de Atletismo." },
            { name: "Autoridade", desc: "Sua voz carrega o peso do comando. As pessoas tendem a obedecer." },
            { name: "Cavalheiro", desc: "Você segue o código de cavalaria e ganha bônus em testes sociais com outros nobres." },
            { name: "Conexões", desc: "Você conhece pessoas em lugares estratégicos de Westeros." },
            { name: "Corajoso", desc: "Você ignora penalidades de medo e ganha bônus em testes de Vontade." },
            { name: "Elo Animal", desc: "Você tem um vínculo místico ou especial com um animal específico." },
            { name: "Esgrimista", desc: "Mestre no uso de lâminas curtas ou longas. +1B em ataques." },
            { name: "Fama", desc: "Sua repuatação o precede, garantindo bônus em testes de Status." },
            { name: "Herdeiro", desc: "Você é o herdeiro legítimo de uma Casa Nobre." },
            { name: "Líder Nato", desc: "Você ganha +1B em testes de Comando e Estratégia." },
            { name: "Literato", desc: "Você sabe ler e escrever em um mundo onde poucos sabem." },
            { name: "Lobo Solitário", desc: "Você ganha bônus quando não há aliados por perto." },
            { name: "Nobreza", desc: "Você nasceu em uma família nobre e possui privilégios sociais." },
            { name: "Patrono", desc: "Alguém poderoso e influente protege você ou financia suas atividades." },
            { name: "Riqueza", desc: "Sua Casa é próspera, permitindo acesso a recursos melhores." },
            { name: "Sentidos Aguçados", desc: "Você ganha +1B em testes de Notar e Percepção." },
            { name: "Status Elevado", desc: "Sua posição social é amplamente respeitada no reino." },
            { name: "Veterano", desc: "Suas cicatrizes contam histórias. Você ignora a primeira penalidade de fadiga." }
        ];

        ui.notifications.info("Preenchendo Compêndio com qualidades iniciais...");

        const itemData = qualities.map(q => {
            return {
                name: q.name,
                type: "item",
                system: {
                    type: "qualidade",
                    description: `<p>${q.desc}</p>`
                },
                img: "icons/skills/social/diplomacy-handshake.webp"
            };
        });

        await Item.createDocuments(itemData, { pack: `world.${packName}` });
        ui.notifications.info("Compêndio de Qualidades criado com sucesso!");
    }

    // WEAPON COMPENDIUM
    const weaponPackLabel = "Armas (Gelo e Fogo)";
    const weaponPackName = "got-armas";
    let weaponPack = game.packs.get(`world.${weaponPackName}`);

    if (!weaponPack) {
        ui.notifications.info("Criando Compêndio de Armas...");
        weaponPack = await CompendiumCollection.createCompendium({
            type: "Item",
            label: weaponPackLabel,
            name: weaponPackName,
            package: "world"
        });

        const weapons = [
            { name: "Adaga", desc: "Lâmina curta e rápida.", dano: 1, bonus: 0, esp: "Lâminas Curtas", attr: "agilidade" },
            { name: "Arco Longo", desc: "Arma de longo alcance. Requer força e técnica.", dano: 2, bonus: 0, esp: "Arcos", attr: "pontaria" },
            { name: "Besta", desc: "Poderosa em curtas distâncias. Dano fixo.", dano: 4, bonus: 0, esp: "Bestas", attr: "nenhum" },
            { name: "Espada Curta", desc: "Versátil para combate. Ágil e precisa.", dano: 2, bonus: 0, esp: "Lâminas Curtas", attr: "agilidade" },
            { name: "Espada Longa", desc: "A arma padrão dos cavaleiros.", dano: 3, bonus: 0, esp: "Lâminas Longas", attr: "atletismo" },
            { name: "Espada de Duas Mãos", desc: "Massiva e devastadora.", dano: 4, bonus: 0, esp: "Lâminas Longas", attr: "atletismo" },
            { name: "Lança", desc: "Mantenha inimigos à distância.", dano: 2, bonus: 0, esp: "Lanças", attr: "atletismo" },
            { name: "Machado de Batalha", desc: "Pesado e capaz de quebrar escudos.", dano: 3, bonus: 0, esp: "Machados", attr: "atletismo" },
            { name: "Maça", desc: "Efetiva contra armaduras pesadas.", dano: 2, bonus: 0, esp: "Maças", attr: "atletismo" },
            { name: "Martelo de Guerra", desc: "Designado para esmagar placas.", dano: 3, bonus: 0, esp: "Machados", attr: "atletismo" }
        ];

        const weaponData = weapons.map(w => {
            return {
                name: w.name,
                type: "item",
                system: {
                    type: "arma",
                    description: `<p>${w.desc}</p>`,
                    dano: w.dano,
                    bonus_dice: w.bonus,
                    especialidade: w.esp,
                    atributo_dano: w.attr
                },
                img: "icons/weapons/swords/sword-guard-steel.webp"
            };
        });

        await Item.createDocuments(weaponData, { pack: `world.${weaponPackName}` });
        ui.notifications.info("Compêndio de Armas criado com sucesso!");
    }

    // DEFECTS COMPENDIUM
    const defectPackLabel = "Defeitos (Gelo e Fogo)";
    const defectPackName = "got-defeitos";
    let defectPack = game.packs.get(`world.${defectPackName}`);

    if (!defectPack) {
        ui.notifications.info("Criando Compêndio de Defeitos...");
        defectPack = await CompendiumCollection.createCompendium({
            type: "Item",
            label: defectPackLabel,
            name: defectPackName,
            package: "world"
        });

        const defects = [
            { name: "Alcoólatra", desc: "Você tem dificuldade em resistir à bebida e sofre penalidades quando está sob efeito ou em abstinência." },
            { name: "Amnésia", desc: "Você esqueceu partes importantes do seu passado." },
            { name: "Arrogante", desc: "Sua confiança excessiva pode ser sua ruína em situações sociais e táticas." },
            { name: "Baixa Estatura", desc: "Você é menor que a média, o que pode afetar sua presença física." },
            { name: "Cego", desc: "Você não possui a visão, dependendo inteiramente de outros sentidos." },
            { name: "Covarde", desc: "Você tem facilidade em sentir medo e dificuldade em agir sob pressão." },
            { name: "Cruel", desc: "Sua falta de empatia pode alienar aliados e criar inimigos implacáveis." },
            { name: "Desonrado", desc: "Sua reputação está manchada por atos passados." },
            { name: "Enfermo", desc: "Sua saúde é frágil e você contrai doenças com facilidade." },
            { name: "Fanático", desc: "Sua devoção cega a uma causa ou religião nubla seu julgamento." },
            { name: "Feio", desc: "Sua aparência física é repulsiva ou perturbadora." },
            { name: "Ganancioso", desc: "O desejo por riquezas motiva todas as suas ações, muitas vezes de forma imprudente." },
            { name: "Manco", desc: "Sua movimentação é limitada por uma lesão permanente na perna." },
            { name: "Mudo", desc: "Você é incapaz de falar vocalmente." },
            { name: "Surdo", desc: "Você é incapaz de ouvir sons." },
            { name: "Vingativo", desc: "Você não consegue deixar passar uma ofensa sem buscar retribuição." }
        ];

        const defectData = defects.map(d => {
            return {
                name: d.name,
                type: "item",
                system: {
                    type: "defeito",
                    description: `<p>${d.desc}</p>`
                },
                img: "icons/magic/control/debuff-energy-hold-blue.webp"
            };
        });

        await Item.createDocuments(defectData, { pack: `world.${defectPackName}` });
        ui.notifications.info("Compêndio de Defeitos criado com sucesso!");
    } else {
        console.log("GOT | Armas e Qualidades já existem. Para atualizar, delete os compêndios 'world.got-armas' e 'world.got-qualidades' e reinicie o Foundry.");
    }
});
