// src/components/chat/MessageInput.jsx
import React, { useState } from 'react';
import './MessageInput.css'; // <--- Thêm dòng này

const MessageInput = ({ onSendMessage, onSendFile }) => {
    const [text, setText] = useState("");

    const handleSend = () => {
        if (text.trim()) {
            onSendMessage(text);
            setText("");
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            onSendFile(e.target.files[0]);
            e.target.value = null; 
        }
    };

    return (
        <div className="chat-input-area">
            {/* Nút Upload */}
            <label className="btn-upload" title="Gửi file đính kèm">
                📎
                <input type="file" hidden onChange={handleFileChange} />
            </label>

            {/* Ô nhập liệu */}
            <input 
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tin nhắn..."
                autoFocus
            />

            {/* Nút Gửi */}
            <button 
                onClick={handleSend}
                disabled={!text.trim()} // Disable nếu không có chữ
            >
                Gửi
            </button>
        </div>
    );
};

export default MessageInput;