console.log("GOT | got-hud.js script loading v1.2...");

/**
 * GOTCombatHUD
 * A stylized battle HUD for chronicling Game of Thrones (SIFRP) in Foundry VTT.
 */
class GOTCombatHUD extends Application {
    constructor(options = {}) {
        super(options);
        this.activeToken = null;
        this.enabled = game.settings.get("got-character-sheet", "hudEnabled");
        console.log("GOT | HUD Status on Init:", this.enabled);
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "got-combat-hud",
            classes: ["got-hud-app", "got-hud-window"],
            template: "modules/got-character-sheet/templates/combat-hud.hbs",
            popOut: true,
            minimizable: false,
            resizable: false
        });
    }

    render(force = false, options = {}) {
        if (!this.enabled && !force) return this.close();
        console.log("GOT | Rendering Combat HUD", { enabled: this.enabled, token: this.activeToken?.name });
        return super.render(force, options);
    }

    getData() {
        if (!this.activeToken) return {};
        const actor = this.activeToken.actor;
        if (!actor) return {};

        const system = actor.system;

        const health = system.combate_intriga.saude;
        const effort = system.combate_intriga.esforco;

        const healthPct = Math.min(100, (health.value / (health.max || 1)) * 100);
        const effortPct = Math.min(100, (effort.value / (effort.max || 1)) * 100);

        const weapons = actor.items.filter(i => i.system?.type === "arma" && i.system?.uso);

        const maneuvers = [
            { id: "derrubar", name: "Derrubar", icon: "fas fa-user-slash" },
            { id: "desarmar", name: "Desarmar", icon: "fas fa-hand-paper" },
            { id: "fintar", name: "Fintar", icon: "fas fa-mask" },
            { id: "manobra_esquiva", name: "Esquivar", icon: "fas fa-shield-alt" }
        ];

        return {
            actor: actor,
            token: this.activeToken,
            system: system,
            healthPct,
            effortPct,
            weapons,
            maneuvers,
            isCombat: !!game.combats.active
        };
    }

    updateToken(token) {
        this.activeToken = token;
        if (token && this.enabled) this.render(true);
        else this.close();
    }

    async toggle() {
        this.enabled = !this.enabled;
        await game.settings.set("got-character-sheet", "hudEnabled", this.enabled);

        if (this.enabled && canvas.tokens.controlled.length > 0) {
            this.updateToken(canvas.tokens.controlled[0]);
        } else {
            this.close();
        }
        ui.notifications.info(`Combat HUD ${this.enabled ? "Ativado" : "Desativado"}. (Tecla K)`);

        // Update sidebar button state if possible
        if (ui.controls) ui.controls.render();
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.hud-nav .item').click(ev => {
            const tab = ev.currentTarget.dataset.tab;
            html.find('.hud-nav .item').removeClass('active');
            $(ev.currentTarget).addClass('active');
            html.find('.tab-pane').removeClass('active');
            html.find(`.tab-pane[data-tab="${tab}"]`).addClass('active');
        });

        html.find('.hud-weapon').click(async ev => {
            const itemId = ev.currentTarget.dataset.itemId;
            const actor = this.activeToken.actor;

            // Re-use rollWeapon logic from sheet
            if (typeof GOTActorSheet !== 'undefined') {
                const sheet = new GOTActorSheet(actor);
                sheet.rollWeapon(itemId);
            } else {
                ui.notifications.error("Erro: GOTActorSheet não encontrada. Recarregue o Foundry.");
            }
        });

        html.find('.maneuver-item').click(async ev => {
            const id = ev.currentTarget.dataset.id;
            const actor = this.activeToken.actor;
            if (typeof GOTActorSheet !== 'undefined') {
                const sheet = new GOTActorSheet(actor);
                const maps = {
                    "derrubar": "atletismo",
                    "desarmar": "luta",
                    "fintar": "engano",
                    "manobra_esquiva": "agilidade"
                };
                const ability = maps[id] || "atletismo";
                const fakeEv = {
                    preventDefault: () => { },
                    currentTarget: { dataset: { label: id.toUpperCase(), ability: ability } }
                };
                sheet._onRoll(fakeEv);
            }
        });

        html.find('.btn-end-turn').click(ev => {
            if (game.combat) game.combat.nextTurn();
            else ui.notifications.warn("Não há combate ativo!");
        });

        html.find('.btn-toggle').click(async ev => {
            const prop = ev.currentTarget.dataset.prop;
            const actor = this.activeToken.actor;
            const current = getProperty(actor, prop);

            if (prop === "system.combate_intriga.esforco_ativo") {
                await actor.update({ [prop]: !current });
                if (!current) {
                    const effort = actor.system.combate_intriga.esforco.value;
                    if (effort > 0) await actor.update({ "system.combate_intriga.esforco.value": effort - 1 });
                }
            } else {
                await actor.update({ [prop]: !current });
            }
            this.render();
        });
    }
}

// Global initialization
Hooks.once("init", () => {
    game.settings.register("got-character-sheet", "hudEnabled", {
        name: "Habilitar HUD de Combate",
        hint: "Mostra o HUD de combate ao selecionar um Token.",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });
});

Hooks.once("ready", () => {
    console.log("GOT | Ready - Initializing Combat HUD");
    game.gotHUD = new GOTCombatHUD();

    // Register Keybinding for 'K'
    game.keybindings.register("got-character-sheet", "toggleHUD", {
        name: "Toggle Combat HUD",
        hint: "Alterna a visibilidade do HUD de Combate para o Token selecionado.",
        editable: [{ key: "KeyK" }],
        onDown: () => {
            game.gotHUD.toggle();
            return true;
        }
    });

    // Auto-detect controlled token on start
    const controlled = canvas.tokens?.controlled || [];
    if (controlled.length > 0) {
        game.gotHUD.updateToken(controlled[0]);
    }
});

// Sidebar Controls
Hooks.on("getSceneControlButtons", (controls) => {
    const tokenControls = controls.find(c => c.name === "token");
    if (tokenControls) {
        tokenControls.tools.push({
            name: "got-combat-hud-toggle",
            title: "Toggle Battle HUD (K)",
            icon: "fas fa-shield-alt",
            toggle: true,
            active: game.gotHUD?.enabled,
            onClick: toggle => game.gotHUD.toggle()
        });
    }
});

// Update Hooks
Hooks.on("controlToken", (token, controlled) => {
    if (controlled) game.gotHUD?.updateToken(token);
    else if (canvas.tokens.controlled.length === 0) game.gotHUD?.updateToken(null);
});

Hooks.on("updateCombat", () => {
    if (game.gotHUD?.enabled && game.gotHUD?.activeToken) game.gotHUD.render();
});
