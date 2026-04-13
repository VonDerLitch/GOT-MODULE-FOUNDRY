
Hooks.on("updateCombat", async (combat, update, options, userId) => {
    if (!("turn" in update || "round" in update)) return;

    // Reset movement flags and sprint for the actor whose turn it is
    const activeCombatant = combat.combatant;
    const actor = activeCombatant?.actor;
    if (actor) {
        console.log(`GOT | Turn Change - Resetting movement for ${actor.name}`);
        await actor.update({ "system.combate_intriga.sprint_ativo": false });
        const token = actor.getActiveTokens()[0];
        if (token) {
            await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
        }
    }

    if (game.gotHUD?.enabled && game.gotHUD?.activeToken) game.gotHUD.render();
});

Hooks.on("preUpdateToken", (tokenDoc, update, options, userId) => {
    if (!game.combat) return; // Only track in combat
    if (!("x" in update || "y" in update)) return;

    const actor = tokenDoc.actor;
    if (!actor) return;

    // Points for distance calculation
    const p0 = { x: tokenDoc.x, y: tokenDoc.y };
    const p1 = {
        x: "x" in update ? update.x : p0.x,
        y: "y" in update ? update.y : p0.y
    };

    if (p0.x === undefined || p1.x === undefined) return;

    // Use Foundry V12 grid measurement
    const path = canvas.grid.measurePath([p0, p1]);
    const gridDist = canvas.scene.grid.distance || 1.5;
    const squaresMoved = path.distance / gridDist;

    if (squaresMoved > 0) {
        const currentDist = tokenDoc.getFlag("got-character-sheet", "distanciaMovida") || 0;
        const newDist = currentDist + squaresMoved;

        // Inject flag directly into the current update transaction
        if (!update.flags) update.flags = {};
        if (!update.flags["got-character-sheet"]) update.flags["got-character-sheet"] = {};
        update.flags["got-character-sheet"].distanciaMovida = newDist;

        console.log(`GOT | Movement Sync - Squares: ${squaresMoved.toFixed(2)} | Total: ${newDist.toFixed(2)} qd`);
    }
});

// Real-time HUD update when token moves (WASD support)
Hooks.on("updateToken", (tokenDoc, update, options, userId) => {
    if (!game.combat) return;

    const isMovement = ("x" in update || "y" in update);
    const isFlagUpdate = (update.flags?.["got-character-sheet"]?.distanciaMovida !== undefined);

    if (!isMovement && !isFlagUpdate) return;

    // Combat HUD (K)
    if (game.gotHUD?.enabled && game.gotHUD?.activeToken?.id === tokenDoc.id) {
        if (isMovement) {
            if (game.gotHUD._renderTimeout) clearTimeout(game.gotHUD._renderTimeout);
            game.gotHUD._renderTimeout = setTimeout(() => {
                game.gotHUD.render();
            }, 50);
        } else {
            game.gotHUD.render();
        }
    }

    // Battle HUD (G)
    if (game.gotBattleHUD?.enabled && game.gotBattleHUD?.activeToken?.id === tokenDoc.id) {
        if (isMovement) {
            if (game.gotBattleHUD._renderTimeout) clearTimeout(game.gotBattleHUD._renderTimeout);
            game.gotBattleHUD._renderTimeout = setTimeout(() => {
                game.gotBattleHUD.render();
            }, 50);
        } else {
            game.gotBattleHUD.render();
        }
    }
});

// Real-time HUD update when Actor changes (Health, Effort, etc.)
Hooks.on("updateActor", (actor, update, options, userId) => {
    if (game.gotHUD?.enabled && game.gotHUD.activeToken?.actor.id === actor.id) {
        game.gotHUD.render();
    }
    if (game.gotBattleHUD?.enabled && game.gotBattleHUD.activeToken?.actor.id === actor.id) {
        game.gotBattleHUD.render();
    }
});

Hooks.on("updateCombat", async (combat, update, options, userId) => {
    if (!("turn" in update || "round" in update)) return;

    // Reset movement flag for the next actor's token
    const combatant = combat.combatant;
    const actor = combatant?.actor;
    if (actor) {
        const token = actor.getActiveTokens()[0];
        if (token) {
            await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
        }
    }

    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("deleteCombat", async (combat) => {
    // Reset all flags when combat is deleted
    for (let c of combat.combatants) {
        const actor = c.actor;
        if (actor) {
            await actor.update({ "system.combate_intriga.sprint_ativo": false });
            const token = actor.getActiveTokens()[0];
            if (token) {
                await token.document.setFlag("got-character-sheet", "distanciaMovida", 0);
            }
        }
    }
    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("targetToken", () => {
    if (game.gotHUD?.enabled) game.gotHUD.render();
    if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
});

Hooks.on("updateUser", (user, update) => {
    if (update.targets) {
        if (game.gotHUD?.enabled) game.gotHUD.render();
        if (game.gotBattleHUD?.enabled) game.gotBattleHUD.render();
    }
});
