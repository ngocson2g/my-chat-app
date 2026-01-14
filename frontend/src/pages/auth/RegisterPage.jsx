import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './LoginPage.css'; // Dùng chung CSS với trang Login

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    display_name: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu nhập lại không khớp!");
      return;
    }

    try {
      // Gọi API Register của Django
      await api.post('register/', {
        username: formData.username,
        password: formData.password,
        display_name: formData.display_name
      });
      alert("Đăng ký thành công! Hãy đăng nhập.");
      navigate('/login'); // Chuyển hướng về trang login
    } catch (err) {
      console.error(err);
      setError("Đăng ký thất bại. Username có thể đã tồn tại.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Tạo tài khoản mới</h2>
        {error && <p className="error-msg">{error}</p>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tên hiển thị</label>
            <input 
              name="display_name"
              type="text" 
              className="form-input"
              value={formData.display_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Username</label>
            <input 
              name="username"
              type="text" 
              className="form-input"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              name="password"
              type="password" 
              className="form-input"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input 
              name="confirmPassword"
              type="password" 
              className="form-input"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn-login">Đăng ký</button>
        </form>
        
        <p style={{marginTop: '15px', fontSize: '0.9rem', color: '#b0b3b8'}}>
          Đã có tài khoản? <Link to="/login" style={{color: '#007bff'}}>Đăng nhập ngay</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;