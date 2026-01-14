import React, { useState, useRef } from 'react';
import { FiImage, FiSmile, FiSend, FiVideo, FiMic, FiPaperclip } from "react-icons/fi"; 
import './ChatInput.css';
const ChatInput = ({ onSendMessage, onSendFile }) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef(null);

  const handleSend = () => {
    if (text.trim()) {
      onSendMessage(text);
      setText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onSendFile(file);
      e.target.value = null;
    }
  };

  return (
    <div className="input-area">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden-input"
        onChange={handleFileChange}
        accept="*"  
      />

      <button className="icon-btn" onClick={() => fileInputRef.current.click()} title="Gửi Ảnh/Video/Audio">
        <FiPaperclip /> 
      </button>

      <input
        type="text"
        className="chat-input"
        placeholder="Nhập tin nhắn..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button className="icon-btn btn-send" onClick={handleSend}>
        <FiSend />
      </button>
    </div>
  );
};

export default ChatInput;