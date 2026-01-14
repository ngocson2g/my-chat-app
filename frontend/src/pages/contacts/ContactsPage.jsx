import React, { useState } from 'react';
import { useContacts } from '../../hooks/useContacts'; // Import Hook
import { useAuth } from '../../context/AuthContext';
import UserAvatar from '../../components/common/UserAvatar/UserAvatar';
import { FiMessageSquare, FiUserPlus } from "react-icons/fi"; 
import AddFriendModal from '../../components/common/Modal/AddFriendModal'; 
import './ContactsPage.css';

const ContactsPage = () => {
  const { user } = useAuth();
  // Gọi Hook: Logic đã được tách biệt hoàn toàn
  const { friends, loading, loadFriends, startChat } = useContacts();
  
  const [showAddFriend, setShowAddFriend] = useState(false); 

  const handleCloseModal = () => {
    setShowAddFriend(false);
    loadFriends(); // Tái sử dụng hàm reload từ hook
  };

  if (loading) return <div className="contacts-container">Đang tải danh bạ...</div>;

  return (
    <div className="contacts-container">
      <div className="contacts-header">
          <h2>Danh bạ bạn bè ({friends.length})</h2>
          <button className="btn-add-friend" onClick={() => setShowAddFriend(true)}>
              <FiUserPlus style={{marginRight: '8px'}}/>
              Thêm bạn mới
          </button>
      </div>
      
      {/* ... Phần hiển thị Grid giữ nguyên ... */}
      {friends.length === 0 ? (
        <div className="empty-contact-state">
            <p>Bạn chưa có bạn bè nào.</p>
            <button className="btn-link" onClick={() => setShowAddFriend(true)}>
                Tìm kiếm bạn bè ngay
            </button>
        </div>
      ) : (
        <div className="contacts-grid">
          {friends.map(friend => (
            <div key={friend.id} className="friend-card">
              <UserAvatar name={friend.username} />
              <div className="friend-info">
                <div className="friend-name">{friend.username}</div>
                <div className="friend-username">@{friend.username}</div>
              </div>
              <button className="btn-chat" onClick={() => startChat(friend.username)}>
                <FiMessageSquare style={{marginRight: '8px'}}/> Nhắn tin
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddFriend && (
        <AddFriendModal onClose={handleCloseModal} currentUser={user} />
      )}
    </div>
  );
};

export default ContactsPage;