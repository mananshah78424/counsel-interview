import { Button } from "./ui/Button";
import { Text } from "./ui/Text";
import { Thread } from "@/db/types";
import { Input } from "./ui/Input";
import { ThreadItem } from "./ThreadItem";
import { useMemo, useState } from "react";

const MENU_WIDTH = 333;

interface LeftMenuProps {
  currentThreadId: string;
  setCurrentThreadId: (id: string) => void;
  threads: Thread[];
}

export default function LeftMenu({
  currentThreadId,
  setCurrentThreadId,
  threads,
}: LeftMenuProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const sortedThreads = useMemo(
    () => threads.sort((a, b) => b.date_created - a.date_created),
    [threads]
  );

  return (
    <div
      style={{
        width: `${MENU_WIDTH}px`,
      }}
      className="inline-flex flex-col items-center transition-all h-[calc(100dvh)] whitespace-normal bg-background-inset"
    >
      <div className="flex space-between justify-start items-center w-full px-5 py-4 gap-3">
        <Text kind="h2-bold" className="text-nowrap">
          Counsel Health
        </Text>
        <div className="w-full"></div>
      </div>
      <div className="w-full px-4 py-2 ">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white"
          placeholder="Search..."
        ></Input>
      </div>

      <div className="flex flex-col items-center w-full min-h-0">
        <div className="flex justify-between px-4 pb-4 w-full">
          <Button className="w-full p-3 h-12 rounded-lg justify-center items-center gap-2">
            <Text kind="body1">New Thread</Text>
          </Button>
        </div>
        <div className="flex flex-col gap-2 w-full overflow-scroll flex-grow border-t py-4 px-1">
          {sortedThreads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              onSwitchThread={() => setCurrentThreadId(thread.id)}
              active={thread.id === currentThreadId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
