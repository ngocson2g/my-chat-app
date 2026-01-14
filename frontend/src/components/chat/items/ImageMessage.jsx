const ImageMessage = ({ url, isOwn }) => (
    <div className={`msg-bubble image ${isOwn ? 'own' : ''}`}>
        <img src={url} alt="Sent content" style={{ maxWidth: '200px', borderRadius: '8px' }} />
    </div>
);
export default ImageMessage;