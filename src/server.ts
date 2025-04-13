import { httpServer } from "./config/app";
import { config } from "dotenv";
import connection from "./config/db";

config();

/* global process */

const port = process.env.PORT || 3000;

process.on("uncaughtException", (error: Error) => {
    console.log("We handle it there", error);

    //handle(error)
    // if (untrusted): process.exit(1)
});

await connection();

httpServer.listen(port, () => {
    console.log(`[server]: Server is running on port ${port}`);
});
