/**
 * Standalone Application for the Large Scale Family Tree
 */
class GOTFamilyTree extends Application {
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
        this.depth = options.depth || 3; // Níveis de profundidade (Avós, Bisavós...)
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "got-family-tree",
            title: "Árvore da Casa",
            template: "modules/got-character-sheet/templates/family-tree-app.hbs",
            width: 1000,
            height: 800,
            resizable: true,
            dragDrop: [{ dragSelector: ".tree-node", dropSelector: null }],
            closeOnSubmit: false,
            submitOnChange: false,
            popOut: true,
            minimizable: true
        });
    }

    /** @override */
    async getData(options) {
        const data = await super.getData(options);
        data.generations = await this._buildGenerations(this.actor);
        return data;
    }

    async _buildGenerations(actor) {
        if (!actor) return null;

        const resolve = async (id) => {
            if (!id) return null;
            return game.actors.get(id);
        };

        const resolveList = async (ids) => {
            if (!ids || !ids.length) return [];
            return await Promise.all(ids.map(id => resolve(id))).then(list => list.filter(a => a));
        };

        const l = actor.system.linhagem || {};

        // 1. Direct Relations
        const pai = await resolve(l.pai);
        const mae = await resolve(l.mae);
        const conjuge = await resolve(l.conjuge);
        const irmaos = await resolveList(l.irmaos);
        const filhos = await resolveList(l.filhos);

        // 2. Grandparents (Generation -2)
        let avosPaternos = [];
        let unclesPaternos = [];
        if (pai) {
            const pl = pai.system.linhagem || {};
            avosPaternos = [await resolve(pl.pai), await resolve(pl.mae)].filter(a => a);
            unclesPaternos = await resolveList(pl.irmaos);
        }

        let avosMaternos = [];
        let unclesMaternos = [];
        if (mae) {
            const ml = mae.system.linhagem || {};
            avosMaternos = [await resolve(ml.pai), await resolve(ml.mae)].filter(a => a);
            unclesMaternos = await resolveList(ml.irmaos);
        }

        // 3. Grandchildren (Generation +2)
        // Group grandchildren by child parent
        const netosGrouped = [];
        if (filhos.length > 0) {
            for (const filho of filhos) {
                const fl = filho.system.linhagem || {};
                const netos = await resolveList(fl.filhos);
                if (netos.length > 0) {
                    netosGrouped.push({
                        parent: filho,
                        children: netos
                    });
                }
            }
        }

        // Helper to format actor data for template
        const fmt = (a) => {
            if (!a) return null;
            // console.log(`GOT | Formatting Actor: ${a.name}, Img: ${a.img}`);
            return { id: a.id, name: a.name, img: a.img };
        };
        const fmtList = (list) => list.map(fmt);

        const result = {
            gen_minus_2: {
                paternal: fmtList(avosPaternos),
                maternal: fmtList(avosMaternos)
            },
            gen_minus_1: {
                paternal_uncles: fmtList(unclesPaternos),
                father: fmt(pai),
                mother: fmt(mae),
                maternal_uncles: fmtList(unclesMaternos)
            },
            gen_0: {
                siblings: fmtList(irmaos),
                self: fmt(actor),
                spouse: fmt(conjuge)
            },
            gen_plus_1: fmtList(filhos),
            gen_plus_2: netosGrouped.map(g => ({
                parent: fmt(g.parent),
                grandkids: fmtList(g.children)
            }))
        };

        console.log("GOT | Family Tree Generations:", result);
        return result;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Clicar em um membro abre a ficha dele
        html.find('.tree-member').click(ev => {
            const actorId = ev.currentTarget.dataset.id;
            const actor = game.actors.get(actorId);
            if (actor) actor.sheet.render(true);
        });

        // Zoom e Pan (Simplificado para o MVP)
        html.find('.tree-canvas').on('wheel', ev => {
            // Implementação futura de zoom
        });
    }
}

// Expose to global scope for got-sheet.js
window.GOTFamilyTree = GOTFamilyTree;
