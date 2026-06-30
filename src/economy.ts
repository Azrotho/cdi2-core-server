import { type Pool, type RowDataPacket } from "mysql2/promise";
import { type Express } from "express";
import { isAdminToken } from "./utils.js";

export function initEconomy(database: Pool) {
    let lastHour = new Date().getHours();
    setInterval(async () => {
        if (new Date().getHours() === lastHour) return;
        lastHour = new Date().getHours();

        if (![8, 10, 12, 14, 16, 18, 20, 22, 0].includes(lastHour)) return;

        let items;
        try {
            [items] = await database.query<RowDataPacket[][]>(
                "SELECT item.*, x.quantity FROM item LEFT JOIN ( SELECT reason AS item, SUM(quantity) AS quantity FROM transaction WHERE timestamp>? GROUP BY reason ) x ON x.item = item.material ORDER BY quantity DESC",
                [Date.now() - 2 * 60 * 60 * 1000]
            );
        } catch (error) {
            console.log("SQL Error");
            return;
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i] as any;
            const rank = i + 1;

            const minPrice = item.price * (1 - item.max_decrease / 100);
            const maxPrice = item.price * (1 + item.max_increase / 100);

            let newPrice = item.current_price;
            if (rank <= 20) {
                const coeff = 0.1 + 0.65 * Math.pow((20 - rank) / 19, 2);
                const ecart = item.current_price - minPrice;
                newPrice -= ecart * coeff;
                newPrice = Math.max(minPrice, newPrice);
            } else if (rank > items.length - 20) {
                const positionFlop = rank - (items.length - 20);
                const coeff = 0.1 + 0.65 * Math.pow((positionFlop - 1) / 19, 2);
                const ecart = maxPrice - item.current_price;
                newPrice += ecart * coeff;
                newPrice = Math.min(maxPrice, newPrice);
            }

            newPrice = Math.round(newPrice);

            if (newPrice !== item.current_price) {
                try {
                    await database.query("UPDATE item SET current_price = ? WHERE material = ?", [
                        newPrice,
                        item.material
                    ]);
                } catch (error) {
                    console.log("SQL Error");
                }
            }
        }
    }, 1000);
}

export function initEconomyRoutes(server: Express, database: Pool) {
    server.get("/economy/items", async (req, res) => {
        const token = req.headers["authorization"];
        if(!token) return res.status(401).send({ error: "No token provided" });
        if(!await isAdminToken(token, database)) return res.status(403).send({ error: "Unauthorized" });
        try {
            const [items] = await database.query<RowDataPacket[]>(
                "SELECT material, price, max_decrease, max_increase, current_price FROM item ORDER BY material"
            );
            res.send({ items });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.get("/economy/items/:material", async (req, res) => {
        const material = req.params.material;
        const token = req.headers["authorization"];
        if(!token) return res.status(401).send({ error: "No token provided" });
        if(!await isAdminToken(token, database)) return res.status(403).send({ error: "Unauthorized" });
        try {
            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT material, price, max_decrease, max_increase, current_price FROM item WHERE material = ?",
                [material]
            );
            const item = rows[0];
            if (!item) {
                return res.status(404).send({ error: "Item not found" });
            }
            res.send({ item });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });

    server.get("/economy/npcs/:npcId", async (req, res) => {
        const npcId = req.params.npcId;
        const token = req.headers["authorization"];
        if(!token) return res.status(401).send({ error: "No token provided" });
        if(!await isAdminToken(token, database)) return res.status(403).send({ error: "Unauthorized" });
        if(!npcId) {
            return res.status(400).send({ error: "NPC ID is required" });
        }
        try {
            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT npc, material, release_day FROM item WHERE npc = ?",
                [npcId]
            );
            if (rows.length === 0) {
                return res.status(404).send({ error: "NPC not found" });
            }
            const npc = {
                npc: npcId,
                release_day: rows[0]!.release_day,
                items: rows.map((r: any) => ({
                    material: r.material,
                    release_day: r.release_day
                }))
            };
            res.send({ npc });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });
    server.get("/economy/npcs", async (req, res) => {
        const token = req.headers["authorization"];
        if(!token) return res.status(401).send({ error: "No token provided" });
        if(!await isAdminToken(token, database)) return res.status(403).send({ error: "Unauthorized" });
        try {
            const [npcs] = await database.query<RowDataPacket[]>(
                "SELECT DISTINCT npc, release_day FROM item"
            );
            res.send({ npcs });
        } catch (err) {
            console.error(err);
            res.status(500).send({ error: "Internal server error" });
        }
    });
}
