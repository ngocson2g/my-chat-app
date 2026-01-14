import '../profile/ProfilePage.css'; // Tận dụng style container

const HelpPage = () => {
  return (
    <div className="page-container">
      <div className="profile-card" style={{textAlign: 'left', maxWidth: '800px'}}>
        <h1 style={{borderBottom: '1px solid #3e4042', paddingBottom: '15px'}}>Trợ giúp & Giới thiệu</h1>
        
        <div style={{marginTop: '20px'}}>
            <h3>Về Chat App</h3>
            <p style={{color: '#b0b3b8', marginTop: '10px', lineHeight: '1.6'}}>
                Đây là ứng dụng nhắn tin thời gian thực được xây dựng với công nghệ hiện đại:
                ReactJS (Frontend), Django (Backend API), Rust (WebSocket Server) và Redis.
                Ứng dụng hỗ trợ nhắn tin nhanh, bảo mật và giao diện tối ưu cho lập trình viên.
            </p>
        </div>

        <div style={{marginTop: '30px'}}>
            <h3>Hướng dẫn sử dụng</h3>
            <ul style={{marginLeft: '20px', marginTop: '10px', color: '#e4e6eb', lineHeight: '1.8'}}>
                <li><strong>Chat:</strong> Chọn một cuộc hội thoại bên trái để bắt đầu nhắn tin.</li>
                <li><strong>Tạo nhóm:</strong> Hiện tại cần liên hệ Admin để tạo nhóm mới.</li>
                <li><strong>Gửi file:</strong> Tính năng đang được phát triển.</li>
            </ul>
        </div>

        <div style={{marginTop: '30px', padding: '15px', backgroundColor: '#3a3b3c', borderRadius: '8px'}}>
            <h3>Liên hệ Support</h3>
            <p>Email: support@chatapp.com</p>
            <p>Hotline: 1900 1234</p>
            <p>Phiên bản: v1.0.0 (Beta)</p>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;