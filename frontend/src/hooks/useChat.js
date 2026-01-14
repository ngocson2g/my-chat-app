import { useState, useEffect, useCallback } from 'react';
import api, { uploadFile } from '../services/api';
import { useWebSocket } from './useWebSocket'; // Giả sử bạn đã tách hook socket riêng
import { useLocation } from 'react-router-dom';

export const useChat = () => {
    const [conversations, setConversations] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const location = useLocation();

    // 1. Kích hoạt Socket Global
    useWebSocket();

    // 2. Load danh sách chat
    useEffect(() => {
        api.get('conversations/')
            .then(res => setConversations(res.data))
            .catch(err => setError(err));
    }, []);

    // 3. Load tin nhắn chi tiết
    useEffect(() => {
        if (!activeChatId) return;

        setLoading(true);
        api.get(`conversations/${activeChatId}/messages/`)
            .then(res => {
                setMessages(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                if (err.response?.status === 404) {
                    alert("Đoạn chat không tồn tại");
                    setActiveChatId(null);
                    setConversations(prev => prev.filter(c => c.conversation_id !== activeChatId));
                }
                setLoading(false);
            });
    }, [activeChatId]);

    // 4. Handle Realtime Updates (Socket)
    useEffect(() => {
        const handleChatUpdate = (event) => {
            const newMsg = event.detail; // 
            if (!newMsg.message_type) {
                const content = newMsg.content || "";
                
                if (content.match(/\.(jpeg|jpg|gif|png)$/i)) {
                    newMsg.message_type = 'image';
                } else if (content.match(/\.(mp4|webm)$/i)) {
                    newMsg.message_type = 'video';
                } else if (content.match(/\.(mp3|wav)$/i)) {
                    newMsg.message_type = 'audio';
                } else if (content.includes('/media/attachments/')) {
                    newMsg.message_type = 'file';
                } else {
                    newMsg.message_type = 'text';
                }
            }'text'

            // Update List bên trái (đưa lên đầu)
            setConversations(prev => {
                const targetIndex = prev.findIndex(c => c.conversation_id === newMsg.conversation_id);
                if (targetIndex !== -1) {
                    const newConvs = [...prev];
                    const updatedConv = {
                        ...newConvs[targetIndex],
                        last_message: { ...newMsg }
                    };
                    newConvs.splice(targetIndex, 1);
                    newConvs.unshift(updatedConv);
                    return newConvs;
                }
                return prev;
            });

            // Update Messages bên phải (nếu đang mở)
            // Lưu ý so sánh == phòng trường hợp string/number
            if (activeChatId && newMsg.conversation_id == activeChatId) {
                setMessages(prev => [...prev, newMsg]);
            }
        };

        window.addEventListener('chat-update', handleChatUpdate);
        return () => window.removeEventListener('chat-update', handleChatUpdate);
    }, [activeChatId]);

    // 5. Actions: Gửi tin nhắn
    const sendMessage = useCallback(async (content) => {
        if (!activeChatId) return;
        try {
            // Mặc định tin nhắn text thì msg_type là 'text'
            await api.post(`conversations/${activeChatId}/messages/`, { 
                content: content,
                message_type: 'text' 
            });
        } catch (err) {
            console.error("Failed to send message", err);
        }
    }, [activeChatId]);

    // 6. Actions: Gửi file
    const sendFile = useCallback(async (file) => {
        if (!activeChatId) return;
        try {
            const data = await uploadFile(file);
            
            // 1. Xác định msg_type dựa trên MIME type của file
            let type = 'file';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';
            
            // 2. Gửi Content là URL sạch, kèm theo msg_type
            // KHÔNG còn nối chuỗi "IMAGE:..." nữa
            await api.post(`conversations/${activeChatId}/messages/`, { 
                content: data.file_url,
                message_type: type  // <--- Trường mới
            });
            
        } catch (err) {
            console.error("Failed to upload", err);
            alert("Lỗi upload file!");
        }
    }, [activeChatId]);

    // 7. Xử lý điều hướng từ danh bạ (Location state)
    useEffect(() => {
        if (location.state?.targetChatId && conversations.length > 0) {
             const exists = conversations.some(c => c.conversation_id === location.state.targetChatId);
             if (exists) {
                 setActiveChatId(location.state.targetChatId);
                 window.history.replaceState({}, document.title);
             }
        }
    }, [location.state, conversations]);

    return {
        conversations,
        activeChatId,
        setActiveChatId,
        activeConversation: conversations.find(c => c.conversation_id === activeChatId),
        messages,
        loading,
        error,
        sendMessage,
        sendFile
    };
};