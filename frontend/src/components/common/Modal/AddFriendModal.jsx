import React, { useState, useEffect } from 'react';
import { FiX, FiUserPlus, FiSearch, FiCheck } from "react-icons/fi";
import { userApi, contactApi } from '../../../services/api'; // Import đúng object mới
import UserAvatar from '../UserAvatar/UserAvatar';
import useDebounce from '../../../hooks/useDebounce';
import './AddFriendModal.css';
import useClickOutside from '../../../hooks/useClickOutside';

const AddFriendModal = ({ onClose, currentUser }) => {
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [incomingRequests, setIncomingRequests] = useState([]);
    const [isFullSearch, setIsFullSearch] = useState(false);
    const [loading, setLoading] = useState(false); // Thêm state loading để UX tốt hơn

    const debouncedQuery = useDebounce(query, 500);

    // Click ra ngoài modal thì đóng
    const modalRef = useClickOutside(onClose);

    // Load danh sách lời mời ngay khi mở modal
    useEffect(() => {
        loadIncomingRequests();
    }, []);

    const loadIncomingRequests = async () => {
        try {
            // Dùng contactApi.getList() thay cho getContacts() cũ
            const data = await contactApi.getList();
            
            // Lọc ra các request mà người khác gửi cho mình (pending)
            // Lưu ý: Backend phải trả về field 'user_to' và 'status' chính xác
            const pending = data.filter(c => c.user_to === currentUser?.username && c.status === 'pending');
            setIncomingRequests(pending);
        } catch (err) {
            console.error("Lỗi tải lời mời kết bạn:", err);
        }
    };

    // --- LOGIC TÌM KIẾM --- //
    
    // Gợi ý nhanh khi gõ (Auto Suggest)
    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setSearchResults([]);
            return;
        }
        // Nếu đang ở chế độ full search rồi thì không load gợi ý nữa
        if (isFullSearch && query === debouncedQuery) return;

        const fetchSuggestions = async () => {
            try {
                // Gọi API mới: userApi.search(query, limit)
                const results = await userApi.search(debouncedQuery, 3);
                setSearchResults(results);
                setIsFullSearch(false);
            } catch (err) {
                console.error(err);
            }
        };
        fetchSuggestions();
    }, [debouncedQuery]);

    // Tìm kiếm đầy đủ (Khi ấn Enter hoặc nút Tìm)
    const handleManualSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        try {
            const results = await userApi.search(query, 20); 
            setSearchResults(results);
            setIsFullSearch(true);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS --- //

    const handleSendRequest = async (username) => {
        try {
            await contactApi.sendRequest(username);
            alert(`Đã gửi lời mời tới ${username}`);
            // Có thể update UI ở đây để disable nút
        } catch (err) {
            // Lấy message lỗi từ backend (nếu có)
            const msg = err.response?.data?.error || "Gửi lời mời thất bại";
            alert(`Lỗi: ${msg}`);
        }
    };

    const handleAccept = async (contactId) => {
        try {
            await contactApi.acceptRequest(contactId);
            alert("Đã trở thành bạn bè!");
            // Reload lại list sau khi accept thành công
            loadIncomingRequests();
        } catch (err) {
            alert("Lỗi khi chấp nhận kết bạn");
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" ref={modalRef}>
                <div className="modal-header">
                    <h3>Thêm bạn bè</h3>
                    <button className="icon-btn close-modal-btn" onClick={onClose}><FiX /></button>
                </div>

                {/* KHU VỰC TÌM KIẾM */}
                <div className="search-bar-container">
                    <input 
                        type="text" 
                        className="search-input-full" 
                        placeholder="Nhập tên người dùng..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            // Nếu user sửa text, thoát chế độ full search để hiện lại gợi ý
                            if (isFullSearch) setIsFullSearch(false);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                        autoFocus
                    />
                    <button className="btn-search-action" onClick={handleManualSearch} disabled={loading}>
                        {loading ? '...' : <FiSearch />}
                    </button>
                </div>

                {/* KẾT QUẢ TÌM KIẾM */}
                {searchResults.length > 0 && (
                    <div className="result-list-container">
                        <div className="section-title">
                            {isFullSearch ? "Kết quả tìm kiếm" : "Gợi ý nhanh"}
                        </div>
                        
                        {searchResults.map(user => (
                            <div key={user.id} className="search-result-item">
                                <div className="user-info-group">
                                    <UserAvatar name={user.username} />
                                    <div className="user-meta">
                                        <span className="user-name-highlight">{user.username}</span>
                                        <span className="user-fullname">
                                            {user.display_name || "Người dùng"}
                                        </span>
                                    </div>
                                </div>
                                
                                {user.username !== currentUser?.username && (
                                    <button 
                                        className="icon-btn add-friend-btn" 
                                        onClick={() => handleSendRequest(user.username)} 
                                        title="Gửi lời mời"
                                    >
                                        <FiUserPlus />
                                    </button>
                                )}
                            </div>
                        ))}
                        
                        {/* Link xem thêm nếu đang ở gợi ý */}
                        {!isFullSearch && searchResults.length >= 3 && (
                            <div className="see-more-link" onClick={handleManualSearch}>
                                Xem thêm kết quả...
                            </div>
                        )}
                    </div>
                )}

                <div className="divider-line"></div>

                {/* DANH SÁCH LỜI MỜI KẾT BẠN */}
                <div className="section-title">Lời mời kết bạn ({incomingRequests.length})</div>
                
                {incomingRequests.length === 0 ? (
                    <div className="empty-msg">Không có lời mời nào đang chờ.</div>
                ) : (
                    <div className="result-list-container">
                        {incomingRequests.map(contact => (
                            <div key={contact.id} className="search-result-item request-item">
                                <div className="user-info-group">
                                    {/* Backend trả về user_from là username người gửi */}
                                    <UserAvatar name={contact.user_from} />
                                    <div className="user-meta">
                                        <span className="user-name-highlight">{contact.user_from}</span>
                                        <small className="request-subtext">Đã gửi lời mời</small>
                                    </div>
                                </div>
                                <button className="btn-action-small" onClick={() => handleAccept(contact.id)}>
                                    Chấp nhận <FiCheck />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddFriendModal;