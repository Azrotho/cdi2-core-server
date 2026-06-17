import dotenv from "dotenv";
import express from "express";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { getTokenOwner, isAdminToken, pass } from "./utils.js";
import { initTeamRoutes } from "./team.js";
import { initPlayerRoutes } from "./player.js";

dotenv.config({ quiet: true });

const server = express();

const database = mysql.createPool({
    host: process.env.DATABASE_HOSTNAME ?? "localhost",
    port: parseInt(process.env.DATABASE_PORT ?? "3306"),
    user: process.env.DATABASE_USERNAME ?? "root",
    password: process.env.DATABASE_PASSWORD ?? "",
    database: process.env.DATABASE_NAME ?? "cdi2"
});

initTeamRoutes(server, database);
initPlayerRoutes(server, database);

server.get("/ping", (req, res) => {
    res.send({ message: "pong!" });
});

server.get("/quoi", (req, res) => {
    res.send({ message: "feur" });
});

server.get("/test-token", async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send({ error: "No token provided" });

    const owner = await getTokenOwner(token, database);
    if (!owner) return res.status(401).send({ error: "Invalid token" });

    res.send({ message: "Token is valid", user: owner });
});

server.post("/token", express.json(), async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send({ error: "No token provided" });
    if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

    const owner = req.body.owner;
    if (!owner) return res.status(400).send({ error: "No owner provided" });

    const newToken = pass(128);
    try {
        await database.query("INSERT INTO token (token, owner) VALUES (?, ?)", [newToken, owner]);
        res.send({ message: "Token created successfully", token: newToken });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to create token" });
    }
});

server.delete("/token", express.json(), async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send({ error: "No token provided" });
    if (!(await isAdminToken(token, database))) return res.status(403).send({ error: "Unauthorized" });

    const tokenToDelete = req.body.token;
    if (!tokenToDelete) return res.status(400).send({ error: "No token provided to delete" });

    try {
        await database.query("DELETE FROM token WHERE token = ?", [tokenToDelete]);
        res.send({ message: "Token deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to delete token" });
    }
});

/**
 * Endpoint pour envoyer un une demande de vérification d'un joueur, renvoie le code de vérification à envoyer au joueur en jeu
 */
server.post("/verify", express.json(), async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(400).send({ error: "No token provided" });

    const uuid = req.body?.uuid;
    const playerName = req.body?.player_name;
    if (!uuid || !playerName) return res.status(400).send({ error: "No uuid or player_name provided" });

    const owner = await getTokenOwner(token, database);
    if (!owner) return res.status(401).send({ error: "Invalid token" });

    if (owner === "admin") {
        try {
            // Bloquer si le joueur existe déjà (déjà vérifié)
            const [existing] = await database.query<RowDataPacket[]>(
                "SELECT 1 FROM player WHERE uuid = ?",
                [uuid]
            );
            if (existing.length > 0) {
                return res.status(409).send({ error: "Player already verified" });
            }

            const [rows] = await database.query<RowDataPacket[]>(
                "SELECT code, expiration FROM verification WHERE uuid = ?",
                [uuid]
            );
            const row = rows[0];
            if (row) {
                if (row.expiration > Date.now()) {
                    return res.send({ message: "OK", code: row.code });
                }
            }

            const verificationCode = pass(8);
            const expiration = Date.now() + 10 * 60 * 1000;

            await database.query(
                "INSERT INTO verification (uuid, player_name, code, expiration) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE player_name = VALUES(player_name), code = VALUES(code), expiration = VALUES(expiration)",
                [uuid, playerName, verificationCode, expiration]
            );

            return res.send({ message: "OK", code: verificationCode });
        } catch (err) {
            console.error(err);
            return res.status(500).send({ error: "Internal server error" });
        }
    } else {
        res.status(403).send({ error: "Unauthorized" });
    }
});

server.post("/verify/check", express.json(), async (req, res) => {
    let uuid = req.body?.uuid;
    const code = req.body?.code;
    const discordId = req.body?.discordId;
    const token = req.headers["authorization"];

    if (!token) return res.status(400).send({ error: "No token provided" });
    const owner = await getTokenOwner(token, database);
    if (!owner) return res.status(401).send({ error: "Invalid token" });
    if(owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

    if (!code || !discordId) {
        return res.status(400).send({ error: "Missing required fields" });
    }

    if (!uuid) {
        const [codeRows] = await database.query<RowDataPacket[]>(
            "SELECT uuid FROM verification WHERE code = ?",
            [code]
        );
        if (!codeRows[0]?.uuid) {
            return res.status(404).send({ error: "Code not found" });
        }
        uuid = codeRows[0].uuid;
    }

    try {
        // Vérifier que le compte Discord n'est pas déjà lié
        const [discordExisting] = await database.query<RowDataPacket[]>(
            "SELECT uuid, name FROM player WHERE discord_id = ?",
            [discordId]
        );
        if (discordExisting[0]) {
            return res.status(409).send({ error: "Discord account already linked", player: discordExisting[0].name });
        }

        const [rows] = await database.query<RowDataPacket[]>(
            "SELECT code, expiration, player_name FROM verification WHERE uuid = ?",
            [uuid]
        );
        const row = rows[0];
        if (!row) {
            return res.status(404).send({ error: "Verification not found" });
        }

        if (row.code !== code) {
            return res.status(400).send({ error: "Invalid code" });
        }

        if (row.expiration < Date.now()) {
            await database.query("DELETE FROM verification WHERE uuid = ?", [uuid]);
            return res.status(400).send({ error: "Code expired" });
        }

        // Vérifier si le joueur est déjà vérifié
        const [existing] = await database.query<RowDataPacket[]>(
            "SELECT discord_id FROM player WHERE uuid = ?",
            [uuid]
        );
        if (existing[0]?.discord_id) {
            return res.status(409).send({ error: "Player already verified" });
        }

        await database.query(
            "INSERT INTO player (uuid, name, discord_id, team) VALUES (?, ?, ?, -1)",
            [uuid, row.player_name, discordId]
        );

        await database.query("DELETE FROM verification WHERE uuid = ?", [uuid]);

        return res.send({ message: "Player verified successfully", player_name: row.player_name });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: "Internal server error" });
    }
});




server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
