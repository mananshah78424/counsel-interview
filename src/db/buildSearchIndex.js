const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Stop words to filter out common, useless words
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with',
  'or', 'but', 'not', 'this', 'they', 'have', 'had', 'what', 'when', 'where', 'who',
  'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'will', 'just', 'should', 'now', 'i', 'you', 'your', 'yours', 'yourself',
  'yourselves', 'me', 'him', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'itself',
  'we', 'us', 'our', 'ours', 'ourselves', 'them', 'their', 'theirs', 'themselves'
]);

// Clean and tokenize text
function tokenizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && // Filter out very short words
      !STOP_WORDS.has(word) && // Filter out stop words
      !/^\d+$/.test(word) // Filter out pure numbers
    );
}

// Build the search index using shell commands
async function buildSearchIndex() {
  console.log("🔌 Querying database using sqlite3 command...");
  
  const dbPath = path.resolve(__dirname, 'counsel_db.sqlite');
  console.log(`Database path: ${dbPath}`);
  
  // First, get the total count
  const countQuery = "SELECT COUNT(*) as total FROM messages";
  const countResult = execSync(`sqlite3 "${dbPath}" "${countQuery}"`, { encoding: 'utf8' });
  const totalMessages = parseInt(countResult.trim());
  console.log(`Total messages in database: ${totalMessages}`);
  
  // Process in batches of 1000
  const batchSize = 1000;
  const searchIndex = {};
  let processedCount = 0;
  
  for (let offset = 0; offset < totalMessages; offset += batchSize) {
    console.log(`Processing batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(totalMessages / batchSize)} (offset: ${offset})`);
    
    const batchQuery = `
      SELECT m.id as messageId, m.threadId, m.message, m.timestamp, m.msgIndex
      FROM messages m
      ORDER BY m.msgIndex
      LIMIT ${batchSize} OFFSET ${offset}
    `;
    
    try {
      const result = execSync(`sqlite3 "${dbPath}" "${batchQuery}"`, { encoding: 'utf8' });
      const lines = result.trim().split('\n');
      
      if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
        console.log(`No more data at offset ${offset}`);
        break;
      }
      
      lines.forEach((line, index) => {
        // Parse the line (sqlite3 output is pipe-separated)
        const parts = line.split('|');
        if (parts.length >= 4) {
          const messageId = parts[0];
          const threadId = parts[1];
          const message = parts[2];
          const timestamp = parts[3];
          
          const tokens = tokenizeText(message);
          
          tokens.forEach(token => {
            // if the token is not in the search index, add it
            if (!searchIndex[token]) {
              searchIndex[token] = [];
            }
            
            // if the token is in the search index, add the message to the token
            searchIndex[token].push({
              threadId: threadId,
              messageId: messageId,
              message: message,
              timestamp: timestamp
            });
          });
          
          processedCount++;
        }
      });
      
      console.log(`Processed ${lines.length} messages in this batch. Total processed: ${processedCount}`);
      
    } catch (error) {
      console.error(`Error processing batch at offset ${offset}:`, error.message);
      break;
    }
  }
  
  console.log(`Successfully processed ${processedCount} messages`);
  console.log("Search index built successfully!");
  return searchIndex;
}

// Save index to JSON file
async function saveSearchIndex(index) {
  const outputPath = path.join(__dirname, 'searchIndex.json');
  
  // Convert to more compact format for storage
  const compactIndex = {};
  
  Object.keys(index).forEach(keyword => {
    compactIndex[keyword] = index[keyword].map(item => 
      `${item.threadId}:${item.messageId}`
    );
  });

  fs.writeFileSync(outputPath, JSON.stringify(compactIndex, null, 2));
  console.log(`Search index saved to: ${outputPath}`);
  
  // Print some stats
  const totalKeywords = Object.keys(compactIndex).length;
  const totalOccurrences = Object.values(compactIndex).reduce((sum, arr) => sum + arr.length, 0);
  
  console.log(`\nIndex Statistics:`);
  console.log(`- Total unique keywords: ${totalKeywords}`);
  console.log(`- Total keyword occurrences: ${totalOccurrences}`);
  console.log(`- Average occurrences per keyword: ${(totalOccurrences / totalKeywords).toFixed(2)}`);
  
  // Show top 10 most common keywords
  const sortedKeywords = Object.entries(compactIndex)
    .sort(([,a], [,b]) => b.length - a.length)
    .slice(0, 10);
  
  console.log(`\nTop 10 most common keywords:`);
  sortedKeywords.forEach(([keyword, occurrences]) => {
    console.log(`- "${keyword}": ${occurrences.length} occurrences`);
  });
}

// Main execution
async function main() {
  try {
    console.log("🚀 Starting search index creation...");
    const index = await buildSearchIndex();
    console.log("📊 Search index created, saving to file...");
    await saveSearchIndex(index);
    console.log("\n✅ Search index creation completed successfully!");
  } catch (error) {
    console.error("❌ Error creating search index:", error);
    process.exit(1);
  }
}

// Run the script
main();
