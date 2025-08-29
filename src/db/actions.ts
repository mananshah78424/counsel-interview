/* this "use server" turns all functions exported from this file into a 'server function'. 
This means each function is wrapped up and actually called from the server, not the client.
 You probably don't need to worry about the details of server functions. 
*/
"use server";
import { Database } from "sqlite3";
import { convertThread, convertMessage, convertUser } from "./utils";
import { open } from "sqlite";

// Relevant Docs: https://www.npmjs.com/package/sqlite#install-sqlite
let db: Awaited<ReturnType<typeof open>> | null = null;

const getDB = async () => {
  if (!db) {
    db = await open({
      filename: "src/db/counsel_db.sqlite", // SQLite DB file
      driver: Database,
    });
  }
  return db;
};
getDB();

// There are 13119 conversations total in the database
// limit to 100 for testing purposes, but try increasing to see if your solution works on more data
const THREAD_LIMIT = 100;
export const getAllThreads = async () => {
  const db = await getDB();
  const result = await db.all(
    `SELECT * FROM threads  ORDER BY threads.date_created DESC LIMIT ${THREAD_LIMIT}`
  );
  return result.map(convertThread);
};

export const getAllUsers = async () => {
  const db = await getDB();
  const result = await db.all("SELECT * FROM users");
  return result.map(convertUser);
};

export const getMessagesForThread = async (threadId: string) => {
  const db = await getDB();
  const result = await db.all(
    `SELECT * FROM messages WHERE threadId = ?`,
    threadId
  );
  return result.map(convertMessage);
};
