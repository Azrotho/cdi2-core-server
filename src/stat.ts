import { type Express } from "express";
import { type Pool, type RowDataPacket } from "mysql2/promise";
import { getTokenOwner } from "./utils.js";

export function initStatRoutes(app: Express, database: Pool) {
    // UUID (player UUID), stat (name of the stat), value (value of the stat), we must return stat value for the team (adding all player stat values for the team)
    app.get("/stat/:uuid/:stat", async (req, res) => {
        const { uuid, stat } = req.params;
        const token = req.headers.authorization?.split(" ")[1] ?? "";
        const owner = await getTokenOwner(token, database);
        if (!owner) {
            res.status(401).send({ message: "Unauthorized" });
            return;
        }
        try {
            const [rows] = await database.query<RowDataPacket[]>(`SELECT value FROM stat WHERE uuid = ? AND stat = ?`, [uuid, stat]);
            const row = rows[0];
            if (!row) {
                res.status(404).send({ message: "Stat not found" });
                return;
            }
            res.send({ value: row.value });
        } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Internal server error" });
        }
    });

    app.get("/stat/team/:team/:stat", async (req, res) => {
        const { team, stat } = req.params;
        const token = req.headers.authorization?.split(" ")[1] ?? "";
        const owner = await getTokenOwner(token, database);
        if (!owner) {
            res.status(401).send({ message: "Unauthorized" });
            return;
        }
        try {
            const [rows] = await database.query<RowDataPacket[]>(`SELECT SUM(value) as total FROM stat WHERE team = ? AND stat = ?`, [team, stat]);
            const row = rows[0];
            if (!row) {
                res.status(404).send({ message: "Stat not found" });
                return;
            }
            res.send({ value: row.total });
        } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Internal server error" });
        }
    });

    app.post("/stat/add/:uuid/:stat", async (req, res) => {
        const { uuid, stat } = req.params;
        const { value } = req.body;
        const token = req.headers.authorization?.split(" ")[1] ?? "";
        const owner = await getTokenOwner(token, database);
        if (!owner) {
            res.status(401).send({ message: "Unauthorized" });
            return;
        }
        try {
            await database.query(`INSERT INTO stat (uuid, stat, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = value + ?`, [uuid, stat, value, value]);
            res.send({ message: "Stat updated" });
        } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Internal server error" });
        }
    });

    app.post("/stat/set/:uuid/:stat", async (req, res) => {
        const { uuid, stat } = req.params;
        const { value } = req.body;
        const token = req.headers.authorization?.split(" ")[1] ?? "";
        const owner = await getTokenOwner(token, database);
        if (!owner) {
            res.status(401).send({ message: "Unauthorized" });
            return;
        }
        try {
            await database.query(`INSERT INTO stat (uuid, stat, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?`, [uuid, stat, value, value]);
            res.send({ message: "Stat set" });
        } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Internal server error" });
        }
    });

    app.delete("/stat/:uuid/:stat", async (req, res) => {
        const { uuid, stat } = req.params;
        const token = req.headers.authorization?.split(" ")[1] ?? "";
        const owner = await getTokenOwner(token, database);
        if (!owner) {
            res.status(401).send({ message: "Unauthorized" });
            return;
        }
        try {
            await database.query(`DELETE FROM stat WHERE uuid = ? AND stat = ?`, [uuid, stat]);
            res.send({ message: "Stat deleted" });
        } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Internal server error" });
        }
    });

}