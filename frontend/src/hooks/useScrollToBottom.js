import { useEffect, useRef } from 'react';

const useScrollToBottom = (dependency) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    
    // Lắng nghe sự kiện khi ảnh/video load xong
    const handleMediaLoad = () => scrollToBottom();
    window.addEventListener('chat-media-loaded', handleMediaLoad);
    
    return () => {
        window.removeEventListener('chat-media-loaded', handleMediaLoad);
    };
  }, [dependency]); // Khi 'dependency' (list tin nhắn) thay đổi -> cuộn xuống

  return messagesEndRef; // Trả về cái ref để gắn vào thẻ div cuối cùng
};

export default useScrollToBottom;