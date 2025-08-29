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

// Semantic map for medical synonyms
const SEMANTIC_MAP: { [key: string]: string[] } = {
  // Pain-related synonyms
  "back": ["spine", "lumbar", "vertebrae", "spinal", "backbone"],
  "pain": ["ache", "discomfort", "soreness", "tenderness", "hurt"],
  "headache": ["migraine", "head pain", "cephalalgia"],
  "chest": ["thoracic", "rib", "sternum", "pectoral"],
  "stomach": ["abdomen", "belly", "gastro", "digestive"],
  
  // Common medical terms
  "fever": ["temperature", "pyrexia", "hot"],
  "cough": ["respiratory", "throat", "bronchial"],
  "nausea": ["sick", "queasy", "vomiting", "upset stomach"],
  "fatigue": ["tired", "exhausted", "weak", "lethargic"],
  
  // Body parts
  "knee": ["patella", "joint", "leg"],
  "shoulder": ["deltoid", "arm", "upper body"],
  "neck": ["cervical", "throat", "upper spine"],
  
  // Symptoms
  "swelling": ["edema", "inflammation", "puffiness"],
  "redness": ["erythema", "inflammation", "rash"],
  "numbness": ["tingling", "paresthesia", "loss of sensation"],
  "paresthesia": ["numbness", "tingling", "loss of sensation"],
};

// Function to get semantic synonyms for a term
const getSemanticSynonyms = (term: string): string[] => {
  const lowerTerm = term.toLowerCase();
  return SEMANTIC_MAP[lowerTerm] || [];
};

// Function to check if we need semantic expansion
const needsSemanticExpansion = (searchIndex: any, tokens: string[]): boolean => {
  let totalMatches = 0;
  
  tokens.forEach(token => {
    if (searchIndex[token]) {
      totalMatches += searchIndex[token].length;
    }
  });
  
  // If we have less than 20 total matches, consider semantic expansion
  return totalMatches < 20;
};

// There are 13119 conversations total in the database
// limit to 100 for testing purposes, but try increasing to see if your solution works on more data
const THREAD_LIMIT = 100;
export const getAllThreads = async () => {
  const db = await getDB();
  const result = await db.all(
    `SELECT * FROM threads  ORDER BY threads.date_created DESC`
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
    
    // Find exact matches first
    const exactMatches = new Set<string>();
    const usedTokens = new Set<string>();
    
    searchTokens.forEach(token => {
      if (searchIndex[token]) {
        console.log("Length of searchIndex[token]:", searchIndex[token].length);
        // Add all matches for this token as exact matches
        searchIndex[token].forEach((item: string) => {
          exactMatches.add(item);
        });
        usedTokens.add(token);
      }
    });
    
    // Check if we need semantic expansion
    let semanticTokens: string[] = [];
    let expandedSearch = false;
    let synonymMatches = new Set<string>();
    
    if (needsSemanticExpansion(searchIndex, searchTokens)) {
      console.log(`Only found ${exactMatches.size} exact results, expanding with semantic search...`);
      expandedSearch = true;
      
      // Get synonyms for each token that had no results
      searchTokens.forEach(token => {
        if (!usedTokens.has(token)) {
          const synonyms = getSemanticSynonyms(token);
          console.log(`Synonyms for "${token}":`, synonyms);
          semanticTokens.push(...synonyms);
        }
      });
      
      // Also try synonyms for tokens that had some results but might benefit from expansion
      searchTokens.forEach(token => {
        const synonyms = getSemanticSynonyms(token);
        semanticTokens.push(...synonyms);
      });
      
      // Remove duplicates and filter out tokens we already searched
      semanticTokens = Array.from(new Set(semanticTokens)).filter(token => 
        !usedTokens.has(token) && token.length > 2
      );
      
      console.log("Semantic tokens to search:", semanticTokens);
      
      // Search with semantic tokens (these are synonym matches)
      semanticTokens.forEach(token => {
        if (searchIndex[token]) {
          console.log(`Semantic search for "${token}":`, searchIndex[token].length, "results");
          searchIndex[token].forEach((item: string) => {
            // Only add if not already in exact matches
            if (!exactMatches.has(item)) {
              synonymMatches.add(item);
            }
          });
        }
      });
    }
    
    // Combine all results for database queries
    const allResults = new Set([...Array.from(exactMatches), ...Array.from(synonymMatches)]);
    
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
    
    // Convert to results array with timestamps and sort by match type, then by date
    const searchResults = Array.from(allResults)
      .map((item: string) => {
        const [threadId, messageId] = item.split(':');
        const isExactMatch = exactMatches.has(item);
        return {
          threadId,
          messageId,
          timestamp: timestampMap.get(messageId) || 0,
          threadName: threadNameMap.get(threadId) || 'Unknown Thread',
          isExactMatch // Flag to identify exact vs synonym matches
        };
      })
      .sort((a, b) => {
        // First sort by match type: exact matches first
        if (a.isExactMatch && !b.isExactMatch) return -1;
        if (!a.isExactMatch && b.isExactMatch) return 1;
        
        // Then sort by date (most recent first) within each group
        return b.timestamp - a.timestamp;
      })
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
            SELECT id, message, msgIndex, timestamp, userId
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
            context: contextMessages,
            matchType: result.isExactMatch ? 'exact' : 'semantic'
          };
        } catch (error) {
          console.error(`Error fetching context for message ${result.messageId}:`, error);
          return result;
        }
      })
    );
    
    // Count exact vs semantic matches
    const exactMatchCount = enhancedResults.filter(r => r.isExactMatch).length;
    const semanticMatchCount = enhancedResults.filter(r => !r.isExactMatch).length;
    
    console.log(`Found ${enhancedResults.length} total results for tokens: ${searchTokens.join(', ')}`);
    console.log(`- Exact matches: ${exactMatchCount}`);
    console.log(`- Semantic matches: ${semanticMatchCount}`);
    
    if (expandedSearch) {
      console.log(`Semantic expansion used. Additional tokens: ${semanticTokens.join(', ')}`);
    }
    
    return {
      results: enhancedResults,
      totalResults: enhancedResults.length,
      exactMatchCount,
      semanticMatchCount,
      searchTokens,
      semanticTokens: expandedSearch ? semanticTokens : [],
      expandedSearch,
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