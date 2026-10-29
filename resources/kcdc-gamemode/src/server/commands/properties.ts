import { readQuoted } from "../args.js";
import type { Command, CommandContext } from "../command.js";
import { retarget } from "../players.js";
import {
    assignOwner,
    clearOwner,
    describeCastle,
    describeCensus,
    describeProperty,
    displayName,
    npcOf,
    getProperty,
    listProperties,
    mapCastle,
    mapCompounds,
    mapLocations,
    mapRegion,
    ownerOf,
    propertiesNear,
    regionNames,
    registerProperty,
    REGIONS,
    removeProperty,
    renameProperty,
    setLocked,
    setRegion,
    tidyLoose,
} from "../properties.js";
import type { PropertyInfo } from "../properties.js";

/** A chat window cannot hold a whole region's catalog; the Chaves page lists it all. */
const LIST_LIMIT = 30;

const KIND: Readonly<Record<PropertyInfo["kind"], string>> = { house: "edifício", chest: "baú", door: "porta" };

function line(property: PropertyInfo): string {
    const owner = ownerOf(property);
    const npc = npcOf(property);
    return `  ${property.id} -- ${displayName(property)} (${property.region}, ${KIND[property.kind]}, ${property.locked ? "trancada" : "livre"}, ${property.keys} chave(s)${owner === null ? "" : `, de ${owner.name}`}${npc === null ? "" : `, casa de ${npc} (NPC)`})`;
}

export const propertyCommand: Command = {
    name: "propriedade",
    summary: "Mapeia e administra as propriedades (casas, oficinas e baús): nome, região, descrição, dono e chaves.",
    usage: [
        "/propriedade mapear <região> [portas]  -- cataloga sozinho os edifícios e baús da região (suchdol, wysoka, raborsch, ou um lugar do mapa); 'portas' inclui portas soltas",
        "/propriedade locais  -- os lugares que o mapa do jogo nomeia, para mapear",
        "/propriedade castelo [região]  -- junta as portas e os baús dentro das muralhas num só imóvel, o castelo (suchdol, raborsch, malesov, pschitoky); sem região, todos",
        "/propriedade organizar  -- põe os baús e as portas soltos para dentro da propriedade mais perto (baú até 50 m, ou 75 m com o nome do lugar, como (Taverna); porta até 35 m, e na casa de outro jogador só a que está colada nela, até 12 m)",
        "/propriedade perto [metros]  -- o que há perto de você, com a distância",
        "/propriedade ir <id>  -- leva você até a propriedade",
        '/propriedade renomear <id> "<nome>"',
        "/propriedade regiao <id> <nome da região>  -- põe a propriedade (e os baús dela) numa região; é assim que as regiões nascem",
        '/propriedade descricao <id> "<texto>"',
        "/propriedade dono <id> [@jogador]  -- o jogador (você, se omitido) vira o dono e recebe as chaves da propriedade",
        "/propriedade dono <id> nenhum  -- tira o dono (as chaves entregues continuam com quem as tem)",
        "/propriedade regioes  -- as regiões que já existem",
        "/propriedade trancar <id>  |  /propriedade destrancar <id>",
        '/propriedade registrar "<nome>" [região]  -- a porta mais próxima vira essa propriedade, trancada',
        "/propriedade remover <id>",
        "/propriedade listar [região]",
        "/propriedade lugar [região]  -- junta numa propriedade só cada lugar da região (a estalagem, o haras, a Toca do Diabo)",
        "/propriedade <id>  -- detalhes de uma propriedade",
    ],

    async run({ player, args, reply, usage }: CommandContext): Promise<void> {
        const [sub, ...rest] = args;
        switch (sub) {
            case "mapear": {
                const loose = rest[rest.length - 1] === "portas";
                const regionId = (loose ? rest.slice(0, -1) : rest).join(" ").replace(/^"|"$/g, "");
                if (!regionId) {
                    reply.line(`Regiões prontas: ${REGIONS.map((region) => region.id).join(", ")}. Qualquer lugar que o mapa nomeia também serve (veja /propriedade locais).`);
                    return;
                }
                const report = mapRegion(regionId, { looseDoors: loose });
                reply.line(report === null ? `'${regionId}' não é uma região nem um lugar do mapa. Veja /propriedade locais.` : describeCensus(report));
                return;
            }

            case "castelo": {
                const named = rest.join(" ").replace(/^"|"$/g, "");
                const ids = named === "" ? REGIONS.filter((region) => region.fortress !== undefined).map((region) => region.id) : [named];
                const lines: string[] = [];
                for (const id of ids) {
                    const report = mapCastle(id);
                    lines.push(report === null ? `'${id}' não tem muralhas conhecidas (castelos: ${REGIONS.filter((region) => region.fortress !== undefined).map((region) => region.id).join(", ")}).` : report.doors === 0 ? `${report.name}: nenhuma porta dentro das muralhas por enquanto (o nível pode ainda não ter dito onde estão).` : describeCastle(report));
                }
                reply.lines(lines);
                return;
            }

            case "lugar": {
                // The places that are one property of a region each (the inn of Pschitoky, the stud farm of Malešov, the Devil's Den), 2026-10-26.
                const named = rest.join(" ").replace(/^"|"$/g, "");
                const ids = named === "" ? REGIONS.filter((region) => region.compounds !== undefined).map((region) => region.id) : [named];
                const lines: string[] = [];
                for (const id of ids) {
                    const reports = mapCompounds(id);
                    if (reports === null) {
                        lines.push(`'${id}' não tem lugares próprios (${REGIONS.filter((region) => region.compounds !== undefined).map((region) => region.id).join(", ")}).`);
                        continue;
                    }
                    lines.push(...reports.map((report) => (report.doors === 0 ? `${report.name}: nenhuma porta por enquanto (o nível pode ainda não ter dito onde estão).` : describeCastle(report))));
                }
                reply.lines(lines);
                return;
            }

            case "organizar": {
                const done = tidyLoose();
                reply.line(done.chests === 0 && done.doors === 0 ? "Nenhum baú ou porta solto perto de uma propriedade: está tudo no lugar." : `${done.chests} baú(s) foram para dentro da propriedade mais perto e ${done.doors} porta(s) passaram a ser portas dela.`);
                reply.lines(done.moved.slice(0, 20).map((line) => `  ${line}`));
                return;
            }

            case "locais": {
                const places = mapLocations();
                if (places.length === 0) {
                    reply.line("O mapa deste nível não dá nome a nenhuma área.");
                    return;
                }
                reply.lines([
                    `Lugares que o mapa nomeia (${places.length}); qualquer um serve para /propriedade mapear "<nome>":`,
                    ...places.map((place) => `  ${place.name} -- em torno de ${((place.box.minX + place.box.maxX) / 2).toFixed(0)} ${((place.box.minY + place.box.maxY) / 2).toFixed(0)}, ${(place.box.maxX - place.box.minX).toFixed(0)} x ${(place.box.maxY - place.box.minY).toFixed(0)} m`),
                ]);
                return;
            }

            case "perto": {
                const radius = Math.min(500, Math.max(5, Number(rest[0]) || 30));
                const near = propertiesNear(player.position, radius).slice(0, 15);
                if (near.length === 0) {
                    reply.line(`Nenhuma propriedade a menos de ${radius} m.`);
                    return;
                }
                reply.lines(near.map(({ property, distance }) => `  ${distance.toFixed(0)} m -- ${property.name} [${property.id}] (${property.locked ? "trancada" : "livre"})`));
                return;
            }

            case "ir": {
                const property = rest[0] ? getProperty(rest[0]) : null;
                if (!property) {
                    reply.line(rest[0] ? `Nenhuma propriedade '${rest[0]}'.` : "Diga qual: /propriedade ir <id>.");
                    return;
                }
                // A little above the stored point, so the body is not put into the floor it stands on.
                const sent = player.teleport({ x: property.x, y: property.y, z: property.z + 1 }, property.name);
                reply.line(sent ? `Indo para ${property.name}.` : "Não consegui pedir o teletransporte agora.");
                return;
            }

            case "renomear": {
                const id = rest[0];
                const { value: name } = readQuoted(rest.slice(1), 0);
                if (!id || !name) {
                    usage();
                    return;
                }
                reply.line(renameProperty(id, name).message);
                return;
            }

            case "regiao":
            case "região": {
                const id = rest[0];
                const name = rest.slice(1).join(" ");
                if (!id || !name) {
                    usage();
                    return;
                }
                reply.line(setRegion(id, name).message);
                return;
            }

            case "regioes":
            case "regiões": {
                const names = regionNames();
                reply.line(names.length === 0 ? "Nenhuma região ainda." : `Regiões: ${names.join(", ")}.`);
                return;
            }

            case "descricao":
            case "descrição": {
                const id = rest[0];
                if (!id) {
                    usage();
                    return;
                }
                const { value: text } = readQuoted(rest.slice(1), 0);
                reply.line(describeProperty(id, text ?? "").message);
                return;
            }

            case "dono": {
                const id = rest[0];
                if (!id) {
                    usage();
                    return;
                }
                if (rest[1] === "nenhum") {
                    reply.line(clearOwner(id).message);
                    return;
                }
                const aimed = retarget(rest.slice(1), player);
                if ("error" in aimed) {
                    reply.line(aimed.error);
                    return;
                }
                reply.line(assignOwner(player, id, aimed.target).message);
                return;
            }

            case "trancar":
            case "destrancar": {
                const id = rest[0];
                if (!id) {
                    usage();
                    return;
                }
                reply.line(setLocked(id, sub === "trancar").message);
                return;
            }

            case "registrar": {
                const { value: name, next } = readQuoted(rest, 0);
                if (!name) {
                    usage();
                    return;
                }
                const region = rest.slice(next).join(" ");
                const result = await registerProperty(player, name, region);
                if (!result.ok) {
                    reply.line(result.reason);
                    return;
                }
                reply.line(`Propriedade '${result.property.id}' registrada: ${result.property.name} (${result.property.region}). Porta trancada.`);
                return;
            }

            case "remover": {
                const id = rest[0];
                if (!id) {
                    usage();
                    return;
                }
                const removed = removeProperty(id);
                reply.line(removed ? `Removida: ${removed.name}. A porta continua como estava.` : `Nenhuma propriedade '${id}'.`);
                return;
            }

            case "listar": {
                const region = rest.join(" ");
                const all = listProperties().filter((property) => !region || property.region.toLowerCase() === region.toLowerCase());
                if (all.length === 0) {
                    reply.line(region ? `Nenhuma propriedade na região '${region}'.` : "Nenhuma propriedade registrada.");
                    return;
                }
                reply.lines([...all.slice(0, LIST_LIMIT).map(line), ...(all.length > LIST_LIMIT ? [`  ... e mais ${all.length - LIST_LIMIT}. A seção Chaves do painel (tecla , ao lado do M) lista todas.`] : [])]);
                return;
            }

            default: {
                const property = sub ? getProperty(sub) : null;
                if (property) {
                    const owner = ownerOf(property);
                    reply.lines([
                        `${displayName(property)} (${property.region}, ${KIND[property.kind]}), ${property.doors.length} porta(s)${property.stashGuid ? ", baú " + property.stashGuid : ""}, chave ${property.keyItem}, ${property.keys} chave(s) entregue(s), ${property.locked ? "trancada" : "livre"}, em ${property.x.toFixed(0)} ${property.y.toFixed(0)} ${property.z.toFixed(0)}.`,
                        owner === null ? "Sem dono." : `Dono: ${owner.name}.`,
                        ...(property.description === "" ? [] : [`Descrição: ${property.description}`]),
                    ]);
                    return;
                }
                usage();
            }
        }
    },
};
