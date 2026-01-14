const TextMessage = ({ content, isOwn }) => (
    <div className={`msg-bubble ${isOwn ? 'own' : ''}`}>
        {content}
    </div>
);
export default TextMessage;