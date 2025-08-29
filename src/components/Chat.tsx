import { Thread, Message, User } from "@/db/types";
import { FC, Fragment, useEffect, useMemo, useState } from "react";
import { TextChatMessage } from "./ChatMessage";
import { Icons } from "./icons";
import { cn } from "@/utils/cssUtils";
import { handlePromiseRejection } from "@/utils/miscUtils";
import { getMessagesForThread } from "@/db/actions";

interface Props {
  thread: Thread | null;
  users: User[];
  searchResults: any;
  onThreadSelect: (threadId: string, messageId?: string) => void;
  scrollToMessageId: string | null;
}

export const Chat: FC<Props> = ({ thread, users, searchResults, onThreadSelect, scrollToMessageId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Debug logging
  console.log("Chat component render:", {
    hasThread: !!thread,
    threadId: thread?.id,
    hasSearchResults: !!searchResults,
    searchResultsCount: searchResults?.results?.length || 0,
    messagesCount: messages.length
  });

  // Clear messages when search results exist to prevent overlap
  useEffect(() => {
    if (searchResults && searchResults.results) {
      console.log("Search results exist, clearing messages");
      setMessages([]);
    }
  }, [searchResults]);

  useEffect(() => {
    if (!thread) {
      // Clear messages when no thread is selected
      setMessages([]);
      return;
    }

    handlePromiseRejection(async () => {
      const fetchedMessages = await getMessagesForThread(thread.id);
      setMessages(fetchedMessages);
    }, "Failed to fetch data");
  }, [thread?.id]);

  // Handle scrolling to specific message
  useEffect(() => {
    if (scrollToMessageId && messages.length > 0) {
      setHighlightedMessageId(scrollToMessageId);
      
      // Find the message element and scroll to it
      const messageElement = document.getElementById(`message-${scrollToMessageId}`);
      if (messageElement) {
        messageElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Keep the highlight persistent (removed timeout)
      }
    }
  }, [scrollToMessageId, messages]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.msgIndex - b.msgIndex),
    [messages]
  );

  // Reverse messages and display in reverse flexbox so we stick to bottom of chat
  const reversedMessages = useMemo(
    () => [...sortedMessages].reverse(),
    [sortedMessages]
  );

  // If we have search results, show ONLY the search results - nothing else
  if (searchResults && searchResults.results) {
    return (
      <div className="relative flex w-full flex-col flex-grow bg-cover h-full">
        <div className="flex flex-col overflow-y-scroll sm:px-[15%] flex-grow p-5">
          {/* Search Results Header */}
          <div className="mb-6 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold text-blue-900">
                Search Results for "{searchResults.searchText}"
              </h2>
              <div className="flex items-center gap-3">
                <div className="text-sm text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  {searchResults.totalResults} results
                </div>
                <button 
                  onClick={() => onThreadSelect("", undefined)}
                  className="text-sm text-gray-600 hover:text-gray-800 px-2 py-1 rounded border hover:bg-gray-50"
                >
                  Clear Search
                </button>
              </div>
            </div>
            
            {searchResults.spellingCorrections && searchResults.spellingCorrections.length > 0 && (
              <div className="mb-3 p-3 bg-blue-50">
                <div className="text-sm text-blue-800 font-medium mb-1">
                   Spelling corrections applied
                </div>
                <div className="text-xs text-blue-700">
                  Corrected terms: {searchResults.spellingCorrections.join(", ")}
                </div>
              </div>
            )}
            
            {searchResults.expandedSearch && searchResults.semanticTokens.length > 0 && (
              <div className="mb-3 p-3 bg-green-50">
                <div className="text-sm text-green-800 font-medium mb-1">
                  Semantic search expanded with synonyms
                </div>
                <div className="text-xs text-green-700">
                  Additional terms searched: {searchResults.semanticTokens.join(", ")}
                </div>
              </div>
            )}
            
            {searchResults.error ? (
              <div className="text-red-600 p-3 bg-red-50 rounded border">
                {searchResults.error}
              </div>
            ) : searchResults.results.length === 0 ? (
              <div className="text-gray-600 p-3 bg-gray-50 rounded border">
                No results found for "{searchResults.searchText}"
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.results.map((result: any, index: number) => (
                  <div 
                    key={`${result.threadId}-${result.messageId}`}
                    className="p-4 bg-white rounded-lg border hover:border-blue-300 cursor-pointer transition-colors"
                    onClick={() => onThreadSelect(result.threadId, result.messageId)}
                  >
                    {/* Thread Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-800 bg-blue-100 px-3 py-1 rounded">
                          {result.threadName || 'Unknown Thread'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {result.timestamp && new Date(result.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {result.timestamp && (
                          <span className="text-xs text-gray-500">
                            {new Date(result.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Context Messages Preview */}
                    {result.context && result.context.length > 0 && (
                      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                        
                        <div className="space-y-2">
                          {result.context.map((ctxMsg: any, ctxIndex: number) => {
                            const isMatchedMessage = ctxMsg.id.toString() === result.messageId;
                            // Use the same logic as ChatMessage: physician on left, patient on right
                            const isPhysician = ctxMsg.userId === 'user2'; // Assuming user2 is physician
                            
                            return (
                              <div 
                                key={ctxMsg.id}
                                className={`flex ${isPhysician ? 'justify-start' : 'justify-end'}`}
                              >
                                <div 
                                  className={`max-w-[80%] p-2 rounded-lg text-sm ${
                                    isMatchedMessage
                                      ? 'bg-yellow-100 border-2 border-yellow-400' // Highlight matched message
                                      : isPhysician
                                      ? 'bg-white border border-gray-200' // Physician messages on left
                                      : 'bg-blue-100 text-blue-900' // Patient messages on right
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    
                                    <span className="text-gray-700">
                                      {ctxMsg.message.length > 120 
                                        ? ctxMsg.message.substring(0, 120) + '...' 
                                        : ctxMsg.message
                                      }
                                    </span>
                                    
                                  </div>
                                  {isMatchedMessage && (
                                    <div className="text-xs text-yellow-700 mt-1 font-medium">
                                      ← This message matched your search
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                
                  </div>
                ))}
                
                {searchResults.results.length > 20 && (
                  <div className="text-center text-blue-600 text-sm py-2">
                    ... and {searchResults.results.length - 20} more results
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show thread messages ONLY if no search results and we have a thread
  if (searchResults && searchResults.results) {
    console.log("Search results exist, not showing thread messages");
    return null;
  }
  
  if (thread === null) {
    console.log("No thread selected, not showing messages");
    return null;
  }

  return (
    <div className="relative flex w-full flex-col flex-grow bg-cover h-full">
      <div className="flex flex-col-reverse overflow-y-scroll sm:px-[15%] flex-grow p-5">
        <div className="flex flex-col-reverse">
          {reversedMessages.map((message) => (
            <Fragment key={`${message.message}-fragment`}>
              <div 
                id={`message-${message.id}`}
                className={`mb-3 transition-all duration-500 ${
                  highlightedMessageId === message.id.toString() 
                    ? 'bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2' 
                    : ''
                }`}
                key={message.message}
              >
                <TextChatMessage
                  user={users.find(({ id }) => id === message.userId)!}
                  message={message}
                />
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      <div className="py-3 px-5 w-full flex sm:px-[15%]">
        <div className={cn("flex flex-col w-full justify-center min-w-0")}>
          <div className="relative flex items-center">
            <div
              className={cn(
                "flex justify-center items-end gap-3 min-h-[44px] p-4 w-full border border-neutral-200 rounded-xl"
              )}
            >
              <Icons.image
                className={cn(
                  `w-6 h-6 flex-shrink-0 cursor-default`,
                  `text-brand-teal`
                )}
              />
              <textarea
                className={cn(
                  "focus:outline-none flex-1 w-full bg-transparent disabled:bg-background-surface max-h-[calc(30dvh)]"
                )}
                style={{ resize: "none" }}
                placeholder="Ask a question..."
                value={""}
                rows={1}
                disabled={true}
              />
              <button className="flex-shrink-0">
                <Icons.plane
                  className={cn("w-6 h-6 cursor-pointer", `text-brand-teal`)}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
