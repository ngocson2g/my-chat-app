import React from 'react';
import TextMessage from './TextMessage';
import ImageMessage from './ImageMessage';
// Import thêm các component khác nếu có (VideoMessage, FileMessage)

const MessageFactory = ({ message, isOwnMessage }) => {
    // Giả sử backend trả về: { content: "url", msg_type: "image", ... }
    const { content, message_type } = message; 

    // Logic mới: Dựa vào msg_type, không cần replace chuỗi
    switch (message_type) {
        case 'image':
            return <ImageMessage url={content} isOwn={isOwnMessage} />;
            
        case 'video':
            // Ví dụ trả về thẻ Video
            return (
                <div className={`msg-bubble video ${isOwnMessage ? 'own' : ''}`}>
                    <video src={content} controls style={{maxWidth: '300px'}} />
                </div>
            );

        case 'file':
            return (
                <div className={`msg-bubble file ${isOwnMessage ? 'own' : ''}`}>
                    <a href={content} target="_blank" rel="noreferrer">📎 Tải xuống file</a>
                </div>
            );

        case 'audio':
             return (
                <div className={`msg-bubble audio ${isOwnMessage ? 'own' : ''}`}>
                    <audio src={content} controls />
                </div>
            );

        case 'text':
        default:
            // Fallback về text nếu không khớp type nào
            return <TextMessage content={content} isOwn={isOwnMessage} />;
    }
};

export default MessageFactory;