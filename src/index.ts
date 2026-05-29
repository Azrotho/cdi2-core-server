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
        await database.query("INSERT INTO team (name, tag, color, leader) VALUES (?, ?, ?, ?)", [
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

function pass(length: number = 8): string {
    const char = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=";
    let password = "";
    for (let i = 0; i < length; i++) {
        const ind = Math.floor(Math.random() * char.length);
        password += char[ind];
    }
    return password;
}

/**
 * Endpoint pour envoyer un une demande de vérification d'un joueur, renvoie le code de vérification à envoyer au joueur en jeu
 */
server.post("/verify", express.json(), async (req, res) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(400).send({ error: "No token provided" });

    const uuid = req.body?.uuid;
    if (!uuid) return res.status(400).send({ error: "No uuid provided" });

    const owner = await getTokenOwner(token);
    if (!owner) return res.status(401).send({ error: "Invalid token" });

    if (owner === "admin") {
        try {
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
                "INSERT INTO verification (uuid, code, expiration) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE code = VALUES(code), expiration = VALUES(expiration)",
                [uuid, verificationCode, expiration]
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

server.listen(3000, () => {
    console.log("Server is running on port 3000");
});
