import { create } from "zustand";
export interface DesignMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}
export const useConversationStore = create(() => ({
  messages: [
    {
      id: "welcome",
      role: "assistant" as const,
      text: "Describe a design, or select something to refine. I will prepare changes for your review.",
    },
  ] as DesignMessage[],
  target: null as string | null,
  designRequest: "",
  finished: false,
}));
export function conversationMessage(role: DesignMessage["role"], text: string) {
  if (!text) return;
  useConversationStore.setState((s) => ({
    messages: [
      ...s.messages,
      {
        id: crypto.randomUUID(),
        role,
        text: text.slice(0, role === "user" ? 1200 : 700),
      },
    ].slice(-40),
  }));
}
export function confirmedDesign(target: string | null, summary: string) {
  useConversationStore.setState({ target, finished: false });
  conversationMessage(
    "assistant",
    summary + " Would you like to make any changes or add details?",
  );
}
export function newConversation() {
  useConversationStore.setState({
    messages: [
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "New conversation. Your scene is preserved. What would you like to design?",
      },
    ],
    target: null,
    designRequest: "",
    finished: false,
  });
}
