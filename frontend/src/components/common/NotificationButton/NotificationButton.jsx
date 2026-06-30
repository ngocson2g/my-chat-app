import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell } from "react-icons/fi";
import { useAuth } from '../../../context/AuthContext';
import './NotificationButton.css'; // Chúng ta sẽ tạo file CSS này ở bước 2

const NotificationButton = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        // Lắng nghe sự kiện từ Socket (Redis Bridge)
        const handleNewNotif = (e) => {
            if (e.detail.sender === user?.username) return; // Bỏ qua tin nhắn tự gửi
            // Khi có tin nhắn/thông báo mới -> Hiện chấm đỏ
            setHasUnread(true);
        };

        window.addEventListener('chat-update', handleNewNotif);
        return () => window.removeEventListener('chat-update', handleNewNotif);
    }, []);

    const handleClick = () => {
        setHasUnread(false); // Click vào thì tắt chấm đỏ
        navigate('/notifications');
    };

    return (
        <button 
            onClick={handleClick} 
            className="icon-btn notif-btn-wrapper" 
            title="Thông báo"
        >
            <FiBell />
            {/* Nếu có tin mới thì hiện chấm đỏ */}
            {hasUnread && <span className="notif-badge"></span>}
        </button>
    );
};

export default NotificationButton;