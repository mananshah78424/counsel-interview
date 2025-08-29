/* this "use server" turns all functions exported from this file into a 'server function'. 
This means each function is wrapped up and actually called from the server, not the client.
 You probably don't need to worry about the details of server functions. 
*/
"use server";
import { Database } from "sqlite3";
import { convertThread, convertMessage, convertUser } from "./utils";
import { open } from "sqlite";
import fs from 'fs';
import path from 'path';

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

export const getSearchedText = async (searchText: string) => {
  try {
    console.log("Searching for:", searchText);
    
    // Load the search index
    const searchIndexPath = path.join(process.cwd(), 'src/db/searchIndex.json');
    const searchIndexData = fs.readFileSync(searchIndexPath, 'utf8');

    // Parse the search index
    const searchIndex = JSON.parse(searchIndexData);
    
    // Split search text into tokens and clean them
    const searchTokens = searchText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(token => token.length > 2); // Filter out very short words
    
    console.log("Search tokens:", searchTokens);
    
    if (searchTokens.length === 0) {
      return { results: [], totalResults: 0, searchTokens: [] };
    }
    
    // Find ALL matching results for each token
    const allResults = new Set<string>(); // Use Set to avoid duplicates
    
    searchTokens.forEach(token => {
      if (searchIndex[token]) {
        console.log("Length of searchIndex[token]:", searchIndex[token].length);
        // Add all matches for this token
        searchIndex[token].forEach((item: string) => {
          allResults.add(item);
        });
      }
    });
    
    // Get the database connection to fetch additional data
    const db = await getDB();
    
    // Fetch timestamps for all message IDs to enable proper date sorting
    const messageIds = Array.from(allResults).map((item: string) => {
      const [threadId, messageId] = item.split(':');
      return messageId;
    });
    
    // Fetch timestamps for these messages
    const timestampQuery = `
      SELECT id, timestamp 
      FROM messages 
      WHERE id IN (${messageIds.map(() => '?').join(',')})
    `;
    
    const timestampResults = await db.all(timestampQuery, messageIds);
    const timestampMap = new Map(
      timestampResults.map(row => [row.id.toString(), row.timestamp])
    );
    
    // Get unique thread IDs to fetch thread names
    const uniqueThreadIds = Array.from(allResults).map((item: string) => {
      const [threadId, messageId] = item.split(':');
      return threadId;
    });
    
    // Fetch thread names
    const threadQuery = `
      SELECT id, title 
      FROM threads 
      WHERE id IN (${uniqueThreadIds.map(() => '?').join(',')})
    `;
    
    const threadResults = await db.all(threadQuery, uniqueThreadIds);
    const threadNameMap = new Map(
      threadResults.map(row => [row.id, row.title])
    );
    
    // Convert to results array with timestamps and sort by date (most recent first)
    const searchResults = Array.from(allResults)
      .map((item: string) => {
        const [threadId, messageId] = item.split(':');
        return {
          threadId,
          messageId,
          timestamp: timestampMap.get(messageId) || 0,
          threadName: threadNameMap.get(threadId) || 'Unknown Thread'
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
      .slice(0, 100); // Limit to top 100 results
    
    // Now fetch context messages for each result (2-3 before and after)
    const enhancedResults = await Promise.all(
      searchResults.map(async (result) => {
        try {
          // Get message index for the matched message
          const messageQuery = `
            SELECT msgIndex 
            FROM messages 
            WHERE id = ?
          `;
          const messageResult = await db.get(messageQuery, [result.messageId]);
          const msgIndex = messageResult?.msgIndex || 0;
          
          // Fetch context messages (2 before, 2 after, plus the matched message)
          const contextQuery = `
            SELECT id, message, msgIndex, timestamp
            FROM messages 
            WHERE threadId = ? 
            AND msgIndex BETWEEN ? AND ?
            ORDER BY msgIndex
          `;
          
          const contextStart = Math.max(0, msgIndex - 2);
          const contextEnd = msgIndex + 2;
          
          const contextMessages = await db.all(contextQuery, [
            result.threadId, 
            contextStart, 
            contextEnd
          ]);
          
          return {
            ...result,
            context: contextMessages
          };
        } catch (error) {
          console.error(`Error fetching context for message ${result.messageId}:`, error);
          return result;
        }
      })
    );
    
    console.log(`Found ${enhancedResults.length} results for tokens: ${searchTokens.join(', ')}`);
    
    return {
      results: enhancedResults,
      totalResults: enhancedResults.length,
      searchTokens,
      searchText
    };
    
  } catch (error) {
    console.error("Error in search:", error);
    return { 
      results: [], 
      totalResults: 0, 
      searchTokens: [], 
      error: "Search failed" 
    };
  }
};