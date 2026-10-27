
import { ChatProvider, useChat } from '../context/ChatContext';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

function Layout() {
  const { activeId } = useChat();
  return (
    <div className={`chat-app ${activeId ? 'has-active' : ''}`}>
      <Sidebar />
      <ChatWindow />
    </div>
  );
}

export default function Chat() {
  return (
    <ChatProvider>
      <Layout />
    </ChatProvider>
  );
}