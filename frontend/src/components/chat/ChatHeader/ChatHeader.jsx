import React from 'react';
import { FiPhone, FiVideo, FiInfo } from "react-icons/fi";
import UserAvatar from '../../common/UserAvatar/UserAvatar';
import './ChatHeader.css';

const ChatHeader = ({ conversation }) => {
  return (
    <div className="chat-header">
      <div className="chat-header-info">
        <UserAvatar name={conversation?.conversation_name || "U"} />
        <div className="chat-header-text">
          <span className="header-title">
            {conversation?.conversation_name || "Phòng chat"}
          </span>
          <span className="status-online">Đang hoạt động</span>
        </div>
      </div>

      <div className="header-actions">
        <button className="icon-btn" title="Gọi thoại"><FiPhone /></button>
        <button className="icon-btn" title="Video call"><FiVideo /></button>
        <button className="icon-btn" title="Thông tin"><FiInfo /></button>
      </div>
    </div>
  );
};

export default ChatHeader;