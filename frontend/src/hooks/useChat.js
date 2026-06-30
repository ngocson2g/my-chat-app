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
    const [uploadingFile, setUploadingFile] = useState(false); // Thêm trạng thái gửi file

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
                // Hỗ trợ cả 2 định dạng: mảng gốc (DB) hoặc có 'results' (Redis Cache / Pagination)
                const messagesData = res.data.results ? res.data.results : res.data;
                setMessages(messagesData);
                setLoading(false);

                // --- ĐÁNH DẤU ĐÃ XEM TẤT CẢ KHI MỞ ĐOẠN CHAT ---
                api.post(`conversations/${activeChatId}/read/`).catch(e => console.error(e));
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
            const data = event.detail; // Có thể là tin nhắn hoặc là receipt

            // --- XỬ LÝ SỰ KIỆN TRẠNG THÁI (ĐÃ NHẬN / ĐÃ XEM) ---
            if (data.type === 'delivered_receipt') {
                setMessages(prev => prev.map(m =>
                    m.message_id === data.message_id && m.status !== 'read' ? { ...m, status: 'delivered' } : m
                ));
                return; // Không cần xử lý các logic tin nhắn bên dưới
            }
            if (data.type === 'read_receipt') {
                setMessages(prev => prev.map(m =>
                    (m.status !== 'read' && m.sender !== data.read_by) ? { ...m, status: 'read' } : m
                ));
                return;
            }
            if (data.type === 'task_update') {
                setMessages(prev => prev.map(m =>
                    m.message_id === data.message_id ? { ...m, external_task: data.external_task } : m
                ));
                return;
            }
            if (data.type === 'process_task_update') {
                setMessages(prev => prev.map(m =>
                    m.message_id === data.message_id ? { ...m, external_process_task: data.external_process_task } : m
                ));
                return;
            }

            // --- XỬ LÝ TIN NHẮN MỚI ---
            const newMsg = data;

            // Tự động báo cáo "Đã nhận" về Server (Nếu tin nhắn không phải là trạng thái sending ảo)
            if (newMsg.message_id && newMsg.status !== 'sending') {
                api.post(`messages/${newMsg.message_id}/delivered/`).catch(e => console.error("Delivered receipt failed", e));
            }

            // Xử lý trường hợp backend trả về 'conversation' (theo chuẩn serializer) thay vì 'conversation_id'
            const convId = newMsg.conversation_id || newMsg.conversation;

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
            }

            // Update List bên trái (đưa lên đầu)
            setConversations(prev => {
                const targetIndex = prev.findIndex(c => c.conversation_id === convId);
                if (targetIndex !== -1) {
                    const newConvs = [...prev];
                    const updatedConv = {
                        ...newConvs[targetIndex],
                        last_message: { ...newMsg }
                    };
                    newConvs.splice(targetIndex, 1);
                    newConvs.unshift(updatedConv);
                    return newConvs;
                } else {
                    // NẾU cuộc trò chuyện chưa tồn tại trong danh sách (Vừa mới kết bạn)
                    // -> Fetch lại danh sách conversation để lấy thông tin avatar/tên của đối phương
                    api.get('conversations/')
                        .then(res => setConversations(res.data))
                        .catch(err => console.error(err));
                    return prev;
                }
            });

            // Update Messages bên phải (nếu đang mở)
            if (activeChatId && String(convId) === String(activeChatId)) {
                setMessages(prev => {
                    // Lọc bỏ tin nhắn fake (Optimistic UI) nếu có cùng loại (để thay bằng tin thật)
                    const filtered = prev.filter(m => m.status !== 'sending');
                    return [...filtered, newMsg];
                });

                // Vì đang mở đoạn chat, nên tin nhắn này hiển thị ngay trên màn hình -> Gửi "Đã xem" luôn
                api.post(`conversations/${activeChatId}/read/`).catch(e => console.error(e));
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
        setUploadingFile(true); // Bắt đầu gửi

        // --- OPTIMISTIC UI: Hiển thị ảnh/video ngay lập tức ---
        let type = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';

        const localId = "temp-" + Date.now();
        const fakeMsg = {
            message_id: localId,
            conversation: activeChatId,
            content: URL.createObjectURL(file), // Lấy preview ảo
            message_type: type,
            sender: "optimistic_sender", // Cờ để UI biết đây là tin của mình
            created_at: new Date().toISOString(),
            status: "sending" // Cờ để WS biết xoá đi khi có tin thật
        };

        // Chèn ngay vào UI để user thấy
        setMessages(prev => [...prev, fakeMsg]);

        try {
            const data = await uploadFile(file);

            // 2. Gửi Content là URL sạch, kèm theo msg_type
            await api.post(`conversations/${activeChatId}/messages/`, {
                content: data.file_url,
                message_type: type
            });

        } catch (err) {
            console.error("Failed to upload", err);
            alert("Lỗi upload file!");
            // Nếu lỗi, xoá tin nhắn ảo đi
            setMessages(prev => prev.filter(m => m.message_id !== localId));
        } finally {
            setUploadingFile(false); // Hoàn tất gửi
        }
    }, [activeChatId]);

    // 6.5. Actions: Gửi Task Odoo
    const sendOdooTask = useCallback(async (taskData) => {
        if (!activeChatId) return;
        try {
            await api.post(`conversations/${activeChatId}/tasks/send/`, taskData);
        } catch (err) {
            console.error("Failed to send Odoo task", err);
            alert("Lỗi khi gửi yêu cầu nhiệm vụ Odoo!");
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
        uploadingFile,
        sendMessage,
        sendFile,
        sendOdooTask
    };
};