import React, { useEffect, useState } from 'react';
import api from '../../services/api'; // Axios instance của bạn
import { useNavigate } from 'react-router-dom';
import { FiBell, FiMessageCircle, FiCheck } from "react-icons/fi";
import { useAuth } from '../../context/AuthContext';
import './NotificationsPage.css';

const NotificationsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // 1. Load lịch sử từ API
    useEffect(() => {
        api.get('notifications/')
            .then(res => setNotifications(res.data))
            .catch(err => console.error(err));
    }, []);

    // 2. Lắng nghe Socket Realtime (để hiện thông báo mới ngay lập tức)
    useEffect(() => {
        const handleNewNotif = (e) => {
            const data = e.detail;
            if (data.sender === user?.username) return; // Bỏ qua tin nhắn tự gửi
            // Tạo một object notification giả lập từ data socket
            const newNotif = {
                id: Date.now(), // ID tạm
                notification_type: 'message',
                content: `${data.sender} vừa nhắn tin cho bạn.`,
                created_at: new Date().toISOString(),
                is_read: false,
                related_id: data.conversation_id
            };
            setNotifications(prev => [newNotif, ...prev]);
        };

        window.addEventListener('chat-update', handleNewNotif);
        return () => window.removeEventListener('chat-update', handleNewNotif);
    }, [user?.username]);

    const handleClickNotif = async (notif) => {
        // Đánh dấu đã đọc (nếu có ID thật từ DB)
        if (notif.id && notif.id < 1000000000000) { 
             try {
                await api.post(`notifications/${notif.id}/mark_read/`);
             } catch(e) {}
        }

        // Điều hướng
        if (notif.notification_type === 'message') {
            navigate('/', { state: { targetChatId: notif.related_id } });
        }
    };

    return (
        <div className="dashboard-container">
            {/* Sidebar giữ nguyên để điều hướng */}

            <div className="notif-window">
                <div className="notif-header">
                    <h2><FiBell style={{marginRight: 10}}/> Thông báo của bạn</h2>
                </div>

                <div className="notif-list">
                    {notifications.length === 0 ? (
                        <p className="empty-notif">Chưa có thông báo nào.</p>
                    ) : (
                        notifications.map((item, index) => (
                            <div 
                                key={index} 
                                className={`notif-item ${item.is_read ? 'read' : 'unread'}`}
                                onClick={() => handleClickNotif(item)}
                            >
                                <div className="notif-icon">
                                    <FiMessageCircle />
                                </div>
                                <div className="notif-content">
                                    <p>{item.content}</p>
                                    <span className="notif-time">
                                        {new Date(item.created_at).toLocaleString('vi-VN')}
                                    </span>
                                </div>
                                {!item.is_read && <div className="unread-dot"></div>}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default NotificationsPage;