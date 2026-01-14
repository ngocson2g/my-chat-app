import React from 'react';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../context/AuthContext';

// Components
import Sidebar from '../../components/layout/Sidebar';
import ChatHeader from '../../components/chat/ChatHeader/ChatHeader';
import MessageList from '../../components/chat/MessageList/MessageList';
import MessageInput from '../../components/chat/MessageInput/MessageInput';
import './ChatDashboard.css';

const ChatDashboard = () => {
    const { user, logout } = useAuth();
    
    // 1. Gọi Hook: Lấy toàn bộ logic và data
    const { 
        conversations, 
        activeChatId, 
        setActiveChatId, 
        activeConversation, 
        messages, 
        loading,
        sendMessage, 
        sendFile 
    } = useChat();

    if (!user) {
        // Nếu chưa có user, không render gì cả (hoặc hiện loading)
        // Việc redirect sẽ do PrivateRoute hoặc Router lo
        return <div className="loading-screen">Đang tải dữ liệu...</div>;
    }

    return (
        <div className="dashboard-container">
            {/* Sidebar nhận data và handler từ hook */}
            <Sidebar 
                user={user} 
                logout={logout} 
                conversations={conversations} 
                activeChatId={activeChatId}
                onSelectChat={setActiveChatId}
            />

            <div className="chat-window">
                {activeChatId && activeConversation ? (
                    <>
                        <ChatHeader conversation={activeConversation} />
                        
                        {loading ? (
                            <div className="loading">Đang tải tin nhắn...</div>
                        ) : (
                            <MessageList 
                                messages={messages} 
                                currentUser={user} 
                            />
                        )}
                        
                        <MessageInput 
                            onSendMessage={sendMessage} 
                            onSendFile={sendFile} 
                        />
                    </>
                ) : (
                    <div className="empty-state">
                        <h3>Xin chào, {user.username}!</h3>
                        <p>Chọn một cuộc trò chuyện để bắt đầu.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatDashboard;