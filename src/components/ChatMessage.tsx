import { Message, User } from "@/db/types";
import { PhysicianProfileCircle } from "./PhysicianProfileCircle";

interface TextChatMessageProps {
  message: Message;
  user: User;
}

export const TextChatMessage: React.FC<TextChatMessageProps> = ({
  message,
  user,
}) => {
  return (
    <div
      className={`flex flex-col w-full min-w-0 ${
        !user.is_physician ? "items-end" : "items-start"
      }`}
    >
      {user.is_physician && (
        <div className="flex items-center">
          <div className="flex items-center gap-2 mb-3 cursor-pointer">
            <PhysicianProfileCircle className="w-6 h-6" />
            <div className="text-sm text-content-primary">
              {"Counsel Physician"}
            </div>
          </div>
        </div>
      )}
      {user.is_physician ? (
        <div style={{ overflowWrap: "anywhere" }}>{message.message}</div>
      ) : (
        <>
          <div
            className={`chatMarkdown flex flex-col items-center bg-bubble-patient-background text-button-secondary-content rounded-md px-4 py-3 max-w-[73%] whitespace-pre-wrap`}
            style={{ overflowWrap: "anywhere" }}
          >
            {message.message}
          </div>
        </>
      )}
    </div>
  );
};
