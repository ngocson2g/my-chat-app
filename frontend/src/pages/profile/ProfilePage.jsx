import React, { useEffect, useState } from 'react';
import { useProfile } from '../../hooks/useProfile'; // Import custom hook
import UserAvatar from '../../components/common/UserAvatar/UserAvatar';
import './ProfilePage.css';

const ProfilePage = () => {
  // 1. Gọi Hook để lấy dữ liệu và hàm xử lý logic
  const { profile, loading, error, updateProfile } = useProfile();
  
  // 2. State quản lý giao diện (UI state)
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    display_name: '',
    phone_number: ''
  });

  // 3. Đồng bộ dữ liệu từ API vào form khi profile thay đổi
  useEffect(() => {
    if (profile) {
        setFormData({
            display_name: profile.display_name || '',
            phone_number: profile.phone_number || ''
        });
    }
  }, [profile]);

  // 4. Hàm xử lý lưu
  const handleSave = async () => {
    // Gọi hàm update từ Hook
    const result = await updateProfile(formData);
    
    if (result.success) {
        setIsEditing(false);
        alert("Cập nhật thành công!");
    } else {
        alert("Lỗi cập nhật thông tin!");
    }
  };

  // 5. Render Loading / Error
  if (loading) return <div className="page-loading">Đang tải hồ sơ...</div>;
  if (error || !profile) return <div className="page-error">Không tải được thông tin. Vui lòng thử lại sau.</div>;

  return (
    <div className="page-container">
      <h2 className="page-title">Hồ sơ cá nhân</h2>
      
      <div className="profile-card">
        {/* --- PHẦN AVATAR --- */}
        <div className="avatar-wrapper">
             <div className="avatar-large-scale">
                <UserAvatar name={profile.username} />
             </div>
        </div>
        
        {/* --- CÁC TRƯỜNG THÔNG TIN --- */}
        
        {/* Username (Không cho sửa) */}
        <div className="profile-field">
          <span className="profile-label">Tên đăng nhập (@username)</span>
          <div className="profile-value readonly">@{profile.username}</div>
        </div>

        {/* Display Name */}
        <div className="profile-field">
          <span className="profile-label">Tên hiển thị</span>
          {isEditing ? (
             <input 
                className="profile-input"
                name="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                placeholder="Nhập tên hiển thị..."
             />
          ) : (
             <div className="profile-value">{profile.display_name || "Chưa đặt tên"}</div>
          )}
        </div>

        {/* Số điện thoại */}
        <div className="profile-field">
          <span className="profile-label">Số điện thoại</span>
          {isEditing ? (
             <input 
                className="profile-input"
                name="phone_number"
                value={formData.phone_number}
                onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
                placeholder="Nhập số điện thoại..."
             />
          ) : (
             <div className="profile-value">{profile.phone_number || "Chưa cập nhật"}</div>
          )}
        </div>
        
        {/* --- CÁC NÚT HÀNH ĐỘNG --- */}
        <div className="profile-actions">
            {isEditing ? (
                <>
                    <button className="btn-action save" onClick={handleSave}>
                        Lưu thay đổi
                    </button>
                    <button 
                        className="btn-action cancel" 
                        onClick={() => {
                            setIsEditing(false);
                            // Reset form về giá trị cũ nếu hủy
                            setFormData({
                                display_name: profile.display_name || '',
                                phone_number: profile.phone_number || ''
                            });
                        }}
                    >
                        Hủy
                    </button>
                </>
            ) : (
                <button className="btn-action edit" onClick={() => setIsEditing(true)}>
                    Chỉnh sửa thông tin
                </button>
            )}
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;