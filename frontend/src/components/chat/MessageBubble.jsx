import React, { useState, useEffect } from 'react';
import './MessageBubble.css';
import { FiDownload, FiFile, FiX } from "react-icons/fi";
import api from '../../services/api';
const BASE_URL = import.meta.env.VITE_BASE_URL;

// --- COMPONENT LIGHTBOX MỚI HỖ TRỢ ZOOM ---
const ImageLightbox = ({ src, onClose }) => {
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Cấm cuộn trang nền khi mở modal
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    const handleWheel = (e) => {
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        setTransform(prev => {
            let newScale = prev.scale * zoomFactor;
            newScale = Math.max(1, Math.min(newScale, 10)); // Min 1x, Max 10x
            
            if (newScale === 1) {
                return { scale: 1, x: 0, y: 0 };
            }

            // Tọa độ chuột so với TÂM màn hình (vì ảnh được center giữa màn hình)
            const cx = e.clientX - window.innerWidth / 2;
            const cy = e.clientY - window.innerHeight / 2;

            const unscaledX = (cx - prev.x) / prev.scale;
            const unscaledY = (cy - prev.y) / prev.scale;
            
            const newX = cx - unscaledX * newScale;
            const newY = cy - unscaledY * newScale;
            
            return { scale: newScale, x: newX, y: newY };
        });
    };

    const handleMouseDown = (e) => {
        // Chỉ cho phép kéo (pan) khi đang zoom to
        if (transform.scale > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging && transform.scale > 1) {
            setTransform(prev => ({
                ...prev,
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            }));
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    // Đóng khi click ra ngoài ảnh (hoặc click vào nút đóng)
    const handleClickBg = (e) => {
        if (e.target.className === 'image-lightbox') {
            onClose();
        }
    };

    return (
        <div 
            className="image-lightbox" 
            onClick={handleClickBg}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <button className="lightbox-close" onClick={onClose}><FiX /></button>
            <img 
                src={src} 
                alt="expanded" 
                className="expanded-image"
                draggable={false} // Tắt drag mặc định của HTML ảnh
                style={{
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                    cursor: transform.scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            />
        </div>
    );
};

// --- COMPONENT XEM TRƯỚC PDF ---
const PdfLightbox = ({ src, onClose }) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    return (
        <div className="pdf-lightbox" onClick={onClose}>
            <button className="lightbox-close" onClick={onClose}><FiX /></button>
            <div className="pdf-container" onClick={e => e.stopPropagation()}>
                <iframe src={src} title="PDF Preview" className="pdf-iframe" />
            </div>
        </div>
    );
};

const MessageBubble = ({ message, isMe }) => {
  const { content, message_type, external_task, external_process_task } = message;
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [updatingTask, setUpdatingTask] = useState(false);

  const handleUpdateProcessTask = async (task_code, status) => {
    setUpdatingTask(true);
    try {
      await api.post(`process-tasks/${task_code}/update-status/`, { status });
    } catch (err) {
      console.error(err);
      alert('Cập nhật task thất bại. Kiểm tra kết nối tới Odoo.');
    } finally {
      setUpdatingTask(false);
    }
  };

  // 3. Xử lý domain cho URL (nếu là đường dẫn tương đối)
  const fullUrl = (content && (content.startsWith("http") || content.startsWith("blob:"))) 
      ? content 
      : `${BASE_URL}${content || ""}`;

  // Helper render nội dung
  const renderContent = () => {
    if (message_type === 'external_process_task' && external_process_task) {
      const isDraft = external_process_task.status === 'draft';
      const isSent = external_process_task.status === 'sent';
      const isDone = external_process_task.status === 'done';
      const isFailed = external_process_task.status === 'failed';
      
      return (
        <div className={`external-task-card external-process-task-card ${external_process_task.status}`}>
          <div className="task-card-header">
            <span className="task-card-icon">⚡</span>
            <span className="task-card-title">ODOO PROCESS TASK</span>
            <span className="task-card-code">{external_process_task.task_code}</span>
          </div>
          <div className="task-card-body">
            <h4 className="task-title">{external_process_task.name}</h4>
            {external_process_task.description && (
              <p className="task-desc">{external_process_task.description}</p>
            )}
          </div>
          <div className="task-card-footer process-footer">
            <div className={`task-status-badge ${external_process_task.status} ${isSent ? 'pending' : (isDone ? 'completed' : '')}`}>
               {isDraft && <span>Nháp</span>}
               {isSent && <><span className="pulse-dot"></span><span>Đang xử lý</span></>}
               {isDone && <><span className="check-icon">✓</span><span>Đã hoàn thành</span></>}
               {isFailed && <span>❌ Thất bại</span>}
            </div>
            
            {isSent && (
               <button 
                  className="task-action-btn"
                  onClick={() => handleUpdateProcessTask(external_process_task.task_code, 'done')}
                  disabled={updatingTask}
               >
                  {updatingTask ? 'Đang cập nhật...' : 'Đánh dấu Hoàn thành'}
               </button>
            )}
          </div>
        </div>
      );
    }

    if (message_type === 'external_task' && external_task) {
      const isPending = external_task.status === 'pending';
      const isFailed = external_task.status === 'failed';
      const respondedAtFormatted = external_task.responded_at 
        ? new Date(external_task.responded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

      return (
        <div className={`external-task-card ${external_task.status}`}>
          <div className="task-card-header">
            <span className="task-card-icon">📋</span>
            <span className="task-card-title">EXTERNAL TASK</span>
            <span className="task-card-code">{external_task.task_code}</span>
          </div>
          <div className="task-card-body">
            <h4 className="task-title">{external_task.title}</h4>
            {external_task.description && (
              <p className="task-desc">{external_task.description}</p>
            )}
            <div className="task-assignee">
              <span className="label">Assignee:</span> <span className="value">{external_task.target_odoo_user}</span>
            </div>
          </div>
          <div className="task-card-footer">
            {isPending && (
              <div className="task-status-badge pending">
                <span className="pulse-dot"></span>
                <span>Chờ phản hồi trên Odoo...</span>
              </div>
            )}
            {isFailed && (
              <div className="task-status-badge failed">
                <span>❌ Lỗi gửi sang Odoo</span>
              </div>
            )}
            {external_task.status === 'responded' && (
              <div className="task-response-section">
                <div className="task-status-badge completed">
                  <span className="check-icon">✓</span>
                  <span>Đã hoàn thành</span>
                </div>
                <div className="task-response-content">
                  <strong>💬 Phản hồi:</strong> {external_task.response_content}
                </div>
                <div className="task-responder-info">
                  Bởi <strong>{external_task.responded_by}</strong> lúc {respondedAtFormatted}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (message_type === 'image') return (
      <>
        <img 
          src={fullUrl} 
          alt="img" 
          className="chat-media" 
          onDoubleClick={() => setIsExpanded(true)}
          title="Nhấn đúp (Double-click) để phóng to"
          style={{ cursor: 'zoom-in' }}
          onLoad={() => window.dispatchEvent(new Event('chat-media-loaded'))} 
        />
        {isExpanded && <ImageLightbox src={fullUrl} onClose={() => setIsExpanded(false)} />}
      </>
    );
    
    if (message_type === 'video') return (
        <video key={fullUrl} controls className="chat-media" onLoadStart={() => window.dispatchEvent(new Event('chat-media-loaded'))}>
          <source src={fullUrl} type="video/mp4" />
        </video>
    );
    
    if (message_type === 'audio') return (
        <audio key={fullUrl} controls className="chat-audio"><source src={fullUrl} /></audio>
    );
    
    if (message_type === 'file') {
        const fileName = content.split('/').pop();
        const isPdf = fileName.toLowerCase().endsWith('.pdf');
        
        return (
            <div className="file-attachment">
                <div className="file-icon"><FiFile /></div>
                <div className="file-info">
                    <span className="file-name">{fileName}</span>
                    <div className="file-actions">
                        {isPdf && (
                            <button 
                                className="preview-link" 
                                onClick={() => setPreviewPdfUrl(fullUrl)}
                            >
                                Xem trước
                            </button>
                        )}
                        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="download-link">
                             Tải xuống <FiDownload />
                        </a>
                    </div>
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
  else if (message_type === 'external_task') bubbleClass += " external-task-msg"; 
  else if (message_type === 'external_process_task') bubbleClass += " external-task-msg"; 
  else bubbleClass += isMe ? " text-msg me" : " text-msg other";

  return (
    <div className={`message-row ${isMe ? 'me' : 'other'}`}>
      <div className="message-wrapper">
          {!isMe && message_type === 'text' && (
             <span className="sender-name">{message.sender}</span>
          )}
          <div className={bubbleClass}>
            {renderContent()}
          </div>
          {/* Trạng thái gửi tin nhắn (Chỉ hiển thị cho người gửi) */}
          {isMe && (
             <span className="message-status">
                 {message.status === 'sending' ? 'Đang gửi...' :
                  message.status === 'delivered' ? 'Đã nhận' :
                  message.status === 'read' ? 'Đã xem' : 'Đã gửi'}
             </span>
          )}
      </div>
      {previewPdfUrl && <PdfLightbox src={previewPdfUrl} onClose={() => setPreviewPdfUrl(null)} />}
    </div>
  );
};

export default MessageBubble;