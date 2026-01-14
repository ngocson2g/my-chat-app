import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMessageSquare, FiUser, FiHelpCircle, FiLogOut, FiUsers, FiBell } from "react-icons/fi";
import { useAuth } from '../../context/AuthContext';
import './SidebarMenu.css';

const SidebarMenu = () => {
  const location = useLocation();
  const { logout } = useAuth();
  
  // State quản lý chấm đỏ cho từng mục riêng biệt
  const [badges, setBadges] = useState({
      message: false, // Chấm đỏ tin nhắn
      contact: false, // Chấm đỏ danh bạ (kết bạn)
      notif: false    // Chấm đỏ thông báo chung
  });

  // Helper để active class CSS
  const isActive = (path) => location.pathname === path ? 'active' : '';

  // Lắng nghe sự kiện Realtime (Redis -> Rust -> Client)
  useEffect(() => {
    const handleSocketEvent = (e) => {
        const data = e.detail; 
        console.log("🔥 Socket Event:", data); // Debug xem nhận được gì

        setBadges(prev => {
            const newState = { ...prev };

            // 1. Logic cho mục "Thông báo" (Chuông)
            // Luôn bật khi có bất kỳ sự kiện nào, TRỪ KHI đang ở trang /notifications
            if (location.pathname !== '/notifications') {
                newState.notif = true;
            }

            // 2. Logic cho mục "Tin nhắn"
            if (data.type === 'new_message') {
                // Chỉ bật nếu KHÔNG PHẢI đang ở trang chat (Trang chủ /)
                if (location.pathname !== '/') {
                    newState.message = true;
                }
            } 
            
            // 3. Logic cho mục "Danh bạ"
            else if (data.type === 'friend_request' || data.type === 'friend_accept') {
                // Chỉ bật nếu KHÔNG PHẢI đang ở trang danh bạ
                if (location.pathname !== '/contacts') {
                    newState.contact = true;
                }
            }

            return newState;
        });
    };

    window.addEventListener('chat-update', handleSocketEvent);
    
    // Cleanup function
    return () => window.removeEventListener('chat-update', handleSocketEvent);
  }, [location.pathname]); // Dependency quan trọng: chạy lại logic khi đổi trang

  // Hàm tắt chấm đỏ khi click vào menu
  const clearBadge = (key) => {
      setBadges(prev => ({ ...prev, [key]: false }));
  };

  return (
    <div className="global-sidebar">
        {/* 1. Tin nhắn */}
        <Link 
            to="/" 
            className={`menu-item ${isActive('/')}`} 
            data-title="Tin nhắn"
            onClick={() => clearBadge('message')}
        >
            <FiMessageSquare />
            {/* Chấm đỏ tin nhắn */}
            {badges.message && <span className="menu-badge"></span>}
        </Link>

        {/* 2. Danh Bạ */}
        <Link 
            to="/contacts" 
            className={`menu-item ${isActive('/contacts')}`} 
            data-title="Danh bạ"
            onClick={() => clearBadge('contact')}
        >
            <FiUsers />
            {/* Chấm đỏ danh bạ */}
            {badges.contact && <span className="menu-badge"></span>}
        </Link>

        {/* 3. Thông Báo */}
        <Link 
            to="/notifications" 
            className={`menu-item ${isActive('/notifications')}`} 
            data-title="Thông báo"
            onClick={() => clearBadge('notif')}
        >
            <FiBell />
            {/* Chấm đỏ thông báo */}
            {badges.notif && <span className="menu-badge"></span>}
        </Link>

        {/* 4. Hồ sơ (Không cần chấm đỏ) */}
        <Link to="/profile" className={`menu-item ${isActive('/profile')}`} data-title="Hồ sơ">
            <FiUser />
        </Link>

        {/* 5. Trợ giúp */}
        <Link to="/help" className={`menu-item ${isActive('/help')}`} data-title="Trợ giúp">
            <FiHelpCircle />
        </Link>

        {/* Logout */}
        <div className="menu-bottom">
            <div className="menu-item" onClick={logout} data-title="Đăng xuất">
                <FiLogOut />
            </div>
        </div>
    </div>
  );
};

export default SidebarMenu;