import React, { useEffect, useRef } from 'react';
import MessageBubble from '../MessageBubble';
import './MessageList.css';
import useScrollToBottom from '../../../hooks/useScrollToBottom';


// Hàm helper để format thời gian hiển thị (VD: 10:30, 20/10/2023)
const formatTimeSeparator = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      day: 'numeric', 
      month: 'numeric', 
      year: 'numeric' 
  });
};
const MessageList = ({ messages, currentUser }) => {
    const messagesEndRef = useScrollToBottom(messages);

    return (
        <div className="messages-area">
        {messages.map((msg, index) => {
            // Logic kiểm tra thời gian
            let showTimestamp = false;

            if (index === 0) {
                // Luôn hiện thời gian cho tin nhắn đầu tiên
                showTimestamp = true;
            } else {
                const currentMsgTime = new Date(msg.created_at);
                const prevMsgTime = new Date(messages[index - 1].created_at);
                
                // Tính khoảng cách (mili giây)
                const diffMs = currentMsgTime - prevMsgTime;
                const diffMins = diffMs / (1000 * 60);

                // Nếu cách nhau > 5 phút thì hiện mốc
                if (diffMins > 5) {
                    showTimestamp = true;
                }
            }

            return (
            <React.Fragment key={index}>
                {/* Render Mốc Thời Gian nếu cần */}
                {showTimestamp && (
                    <div className="time-separator">
                        <span>{formatTimeSeparator(msg.created_at)}</span>
                    </div>
                )}

                <MessageBubble
                message={msg}
                isMe={msg.sender === currentUser?.username}
                />
            </React.Fragment>
            );
        })}
        
        <div ref={messagesEndRef} />
        </div>
    );
};

export default MessageList;