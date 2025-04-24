// Export all socket handlers
export { handleMessageEvents } from "./handleMessageEvents";
export { handleConversationEvents } from "./handleConversationEvents";
export { handleRecentConversationsEvents } from "./handleRecentConversationsEvents";
export { handleSearchEvents } from "./handleSearchEvents";
export { handleFriendEvents } from "./handleFriendEvents";
export { SocketServiceHelpers } from "./socketService.helpers";

// For backward compatibility
export { SocketUtils as SocketHelpers } from "@utils/socketUtils";