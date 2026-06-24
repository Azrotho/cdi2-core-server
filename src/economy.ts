import { type Pool, type RowDataPacket } from "mysql2/promise";

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
