// src/components/chat/MessageInput.jsx
import React, { useState } from 'react';
import './MessageInput.css';

const MessageInput = ({ onSendMessage, onSendFile, onSendOdooTask }) => {
    const [text, setText] = useState("");
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDesc, setTaskDesc] = useState("");
    const [taskAssignee, setTaskAssignee] = useState("admin");

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

    const handleSendTask = () => {
        if (taskTitle.trim() && taskDesc.trim() && taskAssignee.trim()) {
            onSendOdooTask({
                title: taskTitle.trim(),
                message: taskDesc.trim(),
                target_user: taskAssignee.trim()
            });
            setTaskTitle("");
            setTaskDesc("");
            setTaskAssignee("admin");
            setShowTaskModal(false);
        }
    };

    return (
        <div className="chat-input-area">
            {/* Nút Upload Ảnh/Video */}
            <label className="btn-upload" title="Gửi Ảnh/Video">
                📷
                <input type="file" accept="image/*,video/*" hidden onChange={handleFileChange} />
            </label>

            {/* Nút Upload Tài liệu */}
            <label className="btn-upload" title="Gửi Tài liệu">
                📎
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.csv" hidden onChange={handleFileChange} />
            </label>

            {/* Nút Giao Task Odoo */}
            <button 
                type="button" 
                className="btn-upload btn-task" 
                title="Giao nhiệm vụ Odoo"
                onClick={() => setShowTaskModal(true)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
            >
                📋
            </button>

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

            {/* Modal Giao Nhiệm Vụ Odoo */}
            {showTaskModal && (
                <div className="task-modal-overlay" onClick={() => setShowTaskModal(false)}>
                    <div className="task-modal-content" onClick={e => e.stopPropagation()}>
                        <h3 className="task-modal-title">📋 Giao Nhiệm Vụ Odoo</h3>
                        <div className="task-modal-form-group">
                            <label>Tiêu đề nhiệm vụ:</label>
                            <input 
                                type="text" 
                                placeholder="Nhập tiêu đề..." 
                                value={taskTitle}
                                onChange={e => setTaskTitle(e.target.value)}
                            />
                        </div>
                        <div className="task-modal-form-group">
                            <label>Nội dung chi tiết:</label>
                            <textarea 
                                placeholder="Nhập mô tả chi tiết nhiệm vụ..." 
                                value={taskDesc}
                                onChange={e => setTaskDesc(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <div className="task-modal-form-group">
                            <label>Người thực hiện (Odoo Username):</label>
                            <input 
                                type="text" 
                                placeholder="Ví dụ: admin" 
                                value={taskAssignee}
                                onChange={e => setTaskAssignee(e.target.value)}
                            />
                        </div>
                        <div className="task-modal-actions">
                            <button className="btn-cancel" onClick={() => setShowTaskModal(false)}>Hủy</button>
                            <button 
                                className="btn-submit" 
                                onClick={handleSendTask}
                                disabled={!taskTitle.trim() || !taskDesc.trim() || !taskAssignee.trim()}
                            >
                                Gửi Nhiệm Vụ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageInput;