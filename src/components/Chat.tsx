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
}

export const Chat: FC<Props> = ({ thread, users }) => {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!thread) return;

    handlePromiseRejection(async () => {
      const fetchedMessages = await getMessagesForThread(thread.id);
      setMessages(fetchedMessages);
    }, "Failed to fetch data");
  }, [thread?.id]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.msgIndex - b.msgIndex),
    [messages]
  );

  // Reverse messages and display in reverse flexbox so we stick to bottom of chat
  const reversedMessages = useMemo(
    () => [...sortedMessages].reverse(),
    [sortedMessages]
  );

  if (thread === null) return null;

  return (
    <div className="relative flex w-full flex-col flex-grow bg-cover h-full">
      <div className="flex flex-col-reverse overflow-y-scroll sm:px-[15%] flex-grow p-5">
        <div className="flex flex-col-reverse">
          {reversedMessages.map((message) => (
            <Fragment key={`${message.message}-fragment`}>
              <div className="mb-3" key={message.message}>
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
