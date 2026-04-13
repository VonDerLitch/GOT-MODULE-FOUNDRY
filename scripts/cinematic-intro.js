/**
 * GoT Cinematic Intro Script 🎬🛡️
 * Version: 1.0 (1:50 Duration Optimization)
 * 
 * Instructions:
 * 1. Create a Folder in the Actors tab (e.g., "Casas dos Jogadores").
 * 2. Put the House actors (Sheet Type: character/feud) inside.
 * 3. Put the Main Characters inside those House folders or as children.
 * 4. Run this Macro.
 */

async function playCinematicIntro() {
    // --- CONFIGURAÇÃO ---
    const TOTAL_DURATION_SEC = 110; // ~1:50
    const AUDIO_PATH = "assets/opening_theme.mp3";
    const EXCLUDE_FOLDERS = ["Criaturas", "Bravos", "3.Default"]; // Pastas para ignorar

    // DICIONÁRIO DE LEMAS (LORE AUTOMÁTICO)
    const LORE_MOTTOS = {
        "Stark": "O Inverno está Chegando",
        "Targaryen": "Fogo e Sangue",
        "Arryn": "Tão Alto quanto a Honra",
        "Mormont": "Aqui Permanecemos",
        "Royce": "Nós Lembramos",
        "Mudd": "Justiça e Tradição",
        "Gardener": "Fortes na Colheita",
        "Belaerys": "O Fogo de Catorze Chamas",
        "Velaryon": "O Velho, o Verdadeiro, o Bravo",
        "Corbray": "A Dama de Desespero",
        "Vance": "Pela Fé e pelo Ferro",
        "Patrulha da Noite": "Eu sou a Espada na Escuridão",
        "Rei Cinzento": "O que está morto não pode morrer",
        "Greyjoy": "Nós não Semeamos",
        "Ghis": "A Pirâmide é Eterna",
        "Yi Ti": "Mandato do Imperador-Deus",
        "Sarnor": "A Força dos Homens Altos",
        "Sar Mel": "O Rio nos Protege",
        "Rhoynar": "O Rio é Vida e Força",
        "Umbar": "Gigantes do Norte",
        "Umber": "Fúria nos Campos",
        "Reed": "Atalaia e Pântano"
    };
    // -------------------

    let houseData = [];

    // Função para extrair dados de uma pasta (e subpastas recursivamente)
    function collectHouses(folder) {
        if (EXCLUDE_FOLDERS.includes(folder.name)) return;

        // 1. Atores diretos nesta pasta que são "Casas" (têm lema ou são 'feud')
        // Filtramos por ter imagem E (lema OU tipo feudo)
        const houses = folder.contents.filter(a =>
            a.img && (a.type === "feud" || (a.system.linhagem?.lema || a.name))
        );

        for (let a of houses) {
            // Busca lema: 1. Do Ator -> 2. Do Dicionário -> 3. Nada
            let motto = a.system.linhagem?.lema || "";
            if (!motto) {
                const loreKey = Object.keys(LORE_MOTTOS).find(key => a.name.includes(key));
                if (loreKey) motto = LORE_MOTTOS[loreKey];
            }

            houseData.push({
                name: a.name,
                img: a.img,
                motto: motto
            });
        }

        // 2. Procurar em subpastas
        if (folder.children && folder.children.length > 0) {
            for (let child of folder.children) {
                collectHouses(child.folder);
            }
        }
    }

    // Executa a busca em TODAS as pastas raiz dos Atores
    const rootFolders = game.folders.filter(f => f.type === "Actor" && !f.folder);
    for (let folder of rootFolders) {
        collectHouses(folder);
    }

    if (houseData.length === 0) {
        ui.notifications.warn("Nenhuma casa encontrada! Certifique-se de que os atores das casas têm uma imagem e um Lema preenchido na aba de linhagem.");
        return;
    }

    // Remove duplicados (caso o mesmo ator esteja em mais de uma pasta)
    houseData = Array.from(new Set(houseData.map(h => h.name)))
        .map(name => houseData.find(h => h.name === name));

    // Calcula tempo por slide para bater ~1:50
    const slideDuration = Math.floor((TOTAL_DURATION_SEC * 1000) / houseData.length);

    ui.notifications.info(`Iniciando abertura cinemática (${houseData.length} casas detectadas).`);

    ui.notifications.info(`Iniciando abertura cinemática (${houseData.length} casas). Tempo por casa: ${(slideDuration / 1000).toFixed(1)}s.`);

    // --- INJEÇÃO DE CSS ---
    const css = `
        #got-cinematic-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: black;
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            font-family: 'Signika', sans-serif;
            color: white;
            transition: opacity 2s ease-in-out;
        }

        .cinematic-slide {
            position: absolute;
            width: 100%;
            height: 100%;
            opacity: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            transition: opacity 1.5s ease-in-out;
        }

        .cinematic-slide.active {
            opacity: 1;
        }

        .cinematic-bg {
            position: absolute;
            width: 110%;
            height: 110%;
            object-fit: cover;
            filter: brightness(0.4) blur(6px);
            animation: kenburns 30s infinite alternate;
        }

        .cinematic-banner {
            max-height: 70vh;
            z-index: 10;
            filter: drop-shadow(0 0 40px black);
            animation: zoomIn 8s ease-out;
            object-fit: contain;
        }

        .cinematic-title {
            font-size: 5.5rem;
            text-transform: uppercase;
            letter-spacing: 15px;
            margin-top: 30px;
            z-index: 10;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.7), 4px 4px 10px black;
            font-weight: bold;
            text-align: center;
        }

        .cinematic-motto {
            font-size: 2.5rem;
            font-style: italic;
            color: #ffd700;
            z-index: 10;
            margin-top: 20px;
            text-shadow: 2px 2px 5px black;
        }

        @keyframes kenburns {
            from { transform: scale(1); }
            to { transform: scale(1.3) translate(40px, 20px); }
        }

        @keyframes zoomIn {
            from { transform: scale(0.6); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
    `;

    if (!document.getElementById("got-cinematic-style")) {
        const style = document.createElement("style");
        style.id = "got-cinematic-style";
        style.innerHTML = css;
        document.head.appendChild(style);
    }

    // --- CRIAÇÃO DO OVERLAY ---
    const overlay = document.createElement("div");
    overlay.id = "got-cinematic-overlay";
    document.body.appendChild(overlay);

    // Audio helper
    if (AUDIO_PATH) {
        AudioHelper.play({ src: AUDIO_PATH, volume: 0.8, loop: false }, false);
    }

    // --- EXECUÇÃO DOS SLIDES ---
    for (let house of houseData) {
        await showSlide(overlay, `
            <img class="cinematic-bg" src="${house.img}">
            <img class="cinematic-banner" src="${house.img}">
            <div class="cinematic-title">${house.name}</div>
            ${house.motto ? `<div class="cinematic-motto">"${house.motto}"</div>` : ''}
        `, slideDuration);
    }

    // Finalização
    overlay.style.opacity = "0";
    setTimeout(() => {
        overlay.remove();
        ui.notifications.info("Abertura finalizada.");
    }, 2000);
}

/**
 * Exibe um slide individual com transição
 */
async function showSlide(container, html, duration) {
    const slide = document.createElement("div");
    slide.className = "cinematic-slide";
    slide.innerHTML = html;
    container.appendChild(slide);

    // Força layout para transição
    void slide.offsetWidth;
    slide.classList.add("active");

    // Espera a duração do slide (menos o tempo de transição out)
    await new Promise(r => setTimeout(r, duration));

    // Fade out
    slide.classList.remove("active");
    await new Promise(r => setTimeout(r, 1500)); // Tempo da transição CSS
    slide.remove();
}

// Inicia
playCinematicIntro();
