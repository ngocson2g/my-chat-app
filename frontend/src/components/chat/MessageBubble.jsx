import React from 'react';
import './MessageBubble.css';
import { FiDownload, FiFile } from "react-icons/fi";
const BASE_URL = import.meta.env.VITE_BASE_URL 

const MessageBubble = ({ message, isMe }) => {
  const { content, message_type } = message

  // 3. Xử lý domain cho URL (nếu là đường dẫn tương đối)
  const fullUrl = (content && content.startsWith("http")) 
      ? content 
      : `${BASE_URL}${content || ""}`;

  // Helper render nội dung
  const renderContent = () => {
    if (message_type === 'image') return <img src={fullUrl} alt="img" className="chat-media" />;
    
    if (message_type === 'video') return (
        <video controls className="chat-media">
          <source src={fullUrl} type="video/mp4" />
        </video>
    );
    
    if (message_type === 'audio') return (
        <audio controls className="chat-audio"><source src={fullUrl} /></audio>
    );
    
    if (message_type === 'file') {
        const fileName = content.split('/').pop();
        return (
            <div className="file-attachment">
                <div className="file-icon"><FiFile /></div>
                <div className="file-info">
                    <span className="file-name">{fileName}</span>
                    <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="download-link">
                         Tải xuống <FiDownload />
                    </a>
                </div>
            </div>
        );
    }
    return <span style={{whiteSpace: 'pre-wrap'}}>{content}</span>;
  };

  // Xác định class CSS
  let bubbleClass = "message-content";
  if (message_type === 'image' || message_type === 'video') bubbleClass += " media-msg";
  else if (message_type === 'audio') bubbleClass += " audio-msg";
  else if (message_type === 'file') bubbleClass += " file-msg"; 
  else bubbleClass += isMe ? " text-msg me" : " text-msg other";

  return (
    <div className={`message-row ${isMe ? 'me' : 'other'}`}>
      {!isMe && message_type === 'text' && (
         <span className="sender-name">{message.sender}</span>
      )}
      <div className={bubbleClass}>
        {renderContent()}
      </div>
    </div>
  );
};

export default MessageBubble;