/* Specify "use client" for Client-side rendered components. Any components that use
   React hooks or browser-specific APIs should be marked as "use client". All children
   of a "use client" component will also be treated as "use client".
   More details: https://nextjs.org/docs/app/building-your-application/rendering/client-components
*/
"use client";

import { Chat } from "@/components/Chat";
import LeftMenu from "@/components/LeftMenu";
import { getAllThreads, getAllUsers } from "@/db/actions";
import { Thread, User } from "@/db/types";
import { handlePromiseRejection } from "@/utils/miscUtils";
import { useEffect, useState } from "react";

export default function ChatApp() {
  const [currentThreadId, setCurrentThreadId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);

  const currentThread =
    threads.find((thread) => thread.id === currentThreadId) ?? null;

  // Handle search results from LeftMenu
  const handleSearchResults = (results: any) => {
    console.log("Setting search results:", results);
    setSearchResults(results);
    // Clear current thread when showing search results
    setCurrentThreadId("");
    setScrollToMessageId(null);
  };

  // Handle thread selection (clear search results)
  const handleThreadSelection = (threadId: string) => {
    console.log("Thread selection:", threadId);
    setCurrentThreadId(threadId);
    setSearchResults(null);
    setScrollToMessageId(null);
  };

  // Handle search result click with specific message
  const handleSearchResultClick = (threadId: string, messageId?: string) => {
    if (threadId === "") {
      // Clear search results and return to thread list
      console.log("Clearing search results");
      setSearchResults(null);
      setCurrentThreadId("");
      setScrollToMessageId(null);
    } else {
      // Navigate to specific thread and message
      console.log("Navigating to thread:", threadId, "message:", messageId);
      setCurrentThreadId(threadId);
      setSearchResults(null);
      setScrollToMessageId(messageId || null);
    }
  };

  useEffect(() => {
    handlePromiseRejection(async () => {
      const users = await getAllUsers();
      setUsers(users);

      const threads = await getAllThreads();
      setThreads(threads);
    }, "Failed to fetch data");
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div
        className={`overflow-x-hidden whitespace-nowrap bg-background-inset relative flex w-full`}
      >
        <LeftMenu
          currentThreadId={currentThreadId}
          setCurrentThreadId={handleThreadSelection}
          threads={threads}
          onSearchResults={handleSearchResults}
        />
        <div className="items-center whitespace-normal w-full inline-flex flex-shrink-1 flex-col h-[calc(100dvh)] bg-background-surface align-top transition-opacity relative min-w-0">
          <Chat 
            users={users} 
            thread={currentThread} 
            searchResults={searchResults}
            onThreadSelect={handleSearchResultClick}
            scrollToMessageId={scrollToMessageId}
          />
        </div>
       
      </div>
    </main>
  );
}
