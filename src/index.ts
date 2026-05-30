import dotenv from "dotenv";
import express from "express";
import mysql, { type RowDataPacket } from "mysql2/promise";

dotenv.config({ quiet: true });

const server = express();

const database = mysql.createPool({
    host: process.env.DATABASE_HOSTNAME ?? "localhost",
    port: parseInt(process.env.DATABASE_PORT ?? "3306"),
    user: process.env.DATABASE_USERNAME ?? "root",
    password: process.env.DATABASE_PASSWORD ?? "",
    database: process.env.DATABASE_NAME ?? "cdi2"
});

async function getTokenOwner(token: string): Promise<string | null> {
    if (!token) return null;
    try {
        const [rows] = await database.query<RowDataPacket[]>("SELECT owner FROM token WHERE token = ?", [token]);
        return rows[0]?.owner ?? null;
    } catch {
        return null;
    }
}

async function isAdminToken(token: string): Promise<boolean> {
    return (await getTokenOwner(token)) === "admin";
}

server.get("/ping", (req, res) => {
    res.send({ message: "pong!" });
});

server.get("/quoi", (req, res) => {
    res.send({ message: "feur" });
});

server.get("/test-token", async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).send({ error: "No token provided" });

    const owner = await getTokenOwner(token);
    if (!owner) return res.status(401).send({ error: "Invalid token" });

    res.send({ message: "Token is valid", user: owner });
});

server.post("/teams", express.json(), async (req, res) => {
    const name = req.body.name;
    const tag = req.body.tag;
    const color = req.body.color;
    const leader = req.body.leader;
    const token = req.headers["authorization"];

    if (!token) return res.status(401).send({ error: "No token provided" });
    if (!(await isAdminToken(token))) return res.status(403).send({ error: "Unauthorized" });
    if (!name || !tag || !color || !leader) return res.status(400).send({ error: "Missing required fields" });

    try {
        await database.query("INSERT INTO team (name, tag, color, leader, staff) VALUES (?, ?, ?, ?, 0)", [
            name,
            tag,
            color,
            leader
        ]);
        res.send({ message: "Team created successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to create team" });
    }
});

server.get("/team/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if(isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
    const token = req.headers["authorization"];

    if (!token) return res.status(401).send({ error: "No token provided" });
    if (!(await isAdminToken(token))) return res.status(403).send({ error: "Unauthorized" });

    try {
        const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM team WHERE id = ?", [id]);
        const team = rows[0];
        if (!team) return res.status(404).send({ error: "Team not found" });
        res.send({ team });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Internal server error" });
    }
});

server.get("/team/:id/players", async (req, res) => {
    const id = parseInt(req.params.id);
    if(isNaN(id)) return res.status(400).send({ error: "Invalid team ID" });
    const token = req.headers["authorization"];

    if (!token) return res.status(401).send({ error: "No token provided" });
    if (!(await isAdminToken(token))) return res.status(403).send({ error: "Unauthorized" });

    try {
        const [rows] = await database.query<RowDataPacket[]>("SELECT * FROM player WHERE team = ?", [id]);
        res.send({ players: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Internal server error" });
    }
});

function pass(length: number = 8): string {
    const char = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=";
    let password = "";
    for (let i = 0; i < length; i++) {
        const ind = Math.floor(Math.random() * char.length);
        password += char[ind];
    }
    return password;
}


server.get("/player/discord/:discordId", async (req, res) => {
    const discordId = req.params.discordId;
    const token = req.headers["authorization"];

    if (!token) return res.status(401).send({ error: "No token provided" });
    const owner = await getTokenOwner(token);
    if (!owner) return res.status(401).send({ error: "Invalid token" });
    if(owner !== "admin" && owner !== discordId) return res.status(403).send({ error: "Unauthorized" });

    try {
        const [rows] = await database.query<RowDataPacket[]>("SELECT uuid, name, discord_id, team FROM player WHERE discord_id = ?", [discordId]);
        const player = rows[0];
        if (!player) {
            return res.status(404).send({ error: "Player not found" });
        }
        res.send({ player });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Internal server error" });
    }
});

server.get("/player/:uuid", async (req, res) => {
    const uuid = req.params.uuid;
    const token = req.headers["authorization"];

    if (!token) return res.status(401).send({ error: "No token provided" });
    const owner = await getTokenOwner(token);
    if (!owner) return res.status(401).send({ error: "Invalid token" });
    if(owner !== "admin" && owner !== uuid) return res.status(403).send({ error: "Unauthorized" });
    
    try {
        const [rows] = await database.query<RowDataPacket[]>("SELECT uuid, name, discord_id, team FROM player WHERE uuid = ?", [uuid]);
        const player = rows[0];
        if (!player) {
            return res.status(404).send({ error: "Player not found" });
        }
        res.send({ player });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Internal server error" });
    }
});

server.delete("/player/:uuid", async (req, res) => {
    const uuid = req.params.uuid;
    const token = req.headers["authorization"];

    if (!token) return res.status(401).send({ error: "No token provided" });
    const owner = await getTokenOwner(token);
    if (!owner) return res.status(401).send({ error: "Invalid token" });
    if(owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

    try {
        await database.query("DELETE FROM player WHERE uuid = ?", [uuid]);
        res.send({ message: "Player deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Internal server error" });
    }
});

server.get("/players", async (req, res) => {
    const token = req.headers["authorization"];

    if (!token) return res.status(401).send({ error: "No token provided" });
    const owner = await getTokenOwner(token);
    if (!owner) return res.status(401).send({ error: "Invalid token" });
    if(owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

    try {
        const [rows] = await database.query<RowDataPacket[]>("SELECT uuid, name, discord_id, team FROM player");
        res.send({ players: rows });
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Internal server error" });
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

    const owner = await getTokenOwner(token);
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
    const uuid = req.body?.uuid;
    const code = req.body?.code;
    const discordId = req.body?.discordId;
    const token = req.headers["authorization"];

    if (!token) return res.status(400).send({ error: "No token provided" });
    const owner = await getTokenOwner(token);
    if (!owner) return res.status(401).send({ error: "Invalid token" });
    if(owner !== "admin") return res.status(403).send({ error: "Unauthorized" });

    if (!uuid || !code || !discordId) {
        return res.status(400).send({ error: "Missing required fields" });
    }

    try {
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

        return res.send({ message: "Player verified successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ error: "Internal server error" });
    }
})




server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
