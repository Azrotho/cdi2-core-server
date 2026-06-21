import { type RowDataPacket, type Pool } from "mysql2/promise";

export async function getTokenOwner(token: string, database: Pool): Promise<string | null> {
    if (!token) return null;
    try {
        const [rows] = await database.query<RowDataPacket[]>("SELECT owner FROM token WHERE token = ?", [token]);
        return rows[0]?.owner ?? null;
    } catch {
        return null;
    }
}

export async function isAdminToken(token: string, database: Pool): Promise<boolean> {
    return (await getTokenOwner(token, database)) === "admin";
}

export function pass(length: number = 8): string {
    const char = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_-+=";
    let password = "";
    for (let i = 0; i < length; i++) {
        const ind = Math.floor(Math.random() * char.length);
        password += char[ind];
    }
    return password;
}
