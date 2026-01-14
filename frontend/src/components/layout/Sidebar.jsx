import React, { useState }from 'react';
import { FiSearch, FiLogOut, FiPlus } from "react-icons/fi";
import UserAvatar from '../common/UserAvatar/UserAvatar';
import './Sidebar.css';
import AddFriendModal from '../common/Modal/AddFriendModal';

// Helper để format nội dung xem trước
const getPreviewContent = (msg) => {
    if (!msg) return "Chưa có tin nhắn";
    
    // Logic mới: Check msg_type
    switch (msg.message_type) {
        case 'image': return "[Hình ảnh]";
        case 'video': return "[Video]";
        case 'audio': return "[Âm thanh]";
        case 'file':  return "[Tập tin]";
        case 'text':
        default:
            // Nếu tin nhắn text quá dài thì cắt bớt
            return msg.content.length > 30 
                ? msg.content.substring(0, 30) + "..." 
                : msg.content;
    }
};

// Format thời gian ngắn gọn (VD: 10:30 hoặc Hôm qua)
const formatTime = (dateString) => {
    if(!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    
    // Nếu cùng ngày -> hiện giờ
    if(date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'});
    }
    // Khác ngày -> hiện ngày/tháng
    return date.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'});
};

const Sidebar = ({ user, logout, conversations, activeChatId, onSelectChat }) => {

    const [showAddFriend, setShowAddFriend] = useState(false);

    return (
        <div className="sidebar">
        <div className="sidebar-header">
            <div className="user-profile">
            <div className="user-info">
                <UserAvatar name={user?.username} />
                <span>{user?.username}</span>
            </div>
            
            <button className="icon-btn danger" onClick={logout} title="Đăng xuất">
                <FiLogOut />
            </button>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '0 5px'}}>
                <h4 style={{color: '#e4e6eb'}}>Đoạn chat</h4>
                <button 
                    className="icon-btn" 
                    title="Thêm bạn bè"
                    onClick={() => setShowAddFriend(true)}
                    style={{backgroundColor: '#3a3b3c'}}
                >
                    <FiPlus />
                </button>
            </div>

            <div className="search-container">
            <FiSearch className="search-icon" />
            <input type="text" placeholder="Tìm kiếm..." className="search-input" />
            </div>

            
        </div>

        <div className="conversation-list">
            {conversations.map(conv => (
              <div 
                key={conv.conversation_id} 
                className={`conversation-item ${activeChatId === conv.conversation_id ? 'active' : ''}`}
                onClick={() => onSelectChat(conv.conversation_id)}
              >
                <UserAvatar name={conv.conversation_name || "G"} />
                
                <div className="conv-info">
                  <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span className="conv-name">
                        {conv.conversation_name}
                      </span>
                      {/* Hiển thị thời gian bên phải */}
                      <span style={{fontSize: '0.75rem', color: '#888'}}>
                        {conv.last_message ? formatTime(conv.last_message.created_at) : ""}
                      </span>
                  </div>
                  
                  {/* Hiển thị nội dung xem trước */}
                  <span className="conv-last-msg" style={{
                      color: conv.last_message ? '#b0b3b8' : '#888',
                      fontWeight: conv.last_message ? 'normal' : 'italic'
                  }}>
                    {conv.last_message 
                        ? `${conv.last_message.sender === user.username ? 'Bạn: ' : ''}${getPreviewContent(conv.last_message)}` 
                        : "Bắt đầu trò chuyện ngay"}
                  </span>
                </div>
              </div>
            ))}
        </div>
        
        {/* HIỂN THỊ MODAL NẾU STATE = TRUE */}
        {showAddFriend && (
            <AddFriendModal 
                onClose={() => setShowAddFriend(false)} 
                currentUser={user}
            />
        )}

        </div>
    );
};

export default Sidebar;