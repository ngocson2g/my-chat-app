import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './LoginPage.css'; // Import file CSS vừa tạo
import { Link } from 'react-router-dom';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(username, password);
    if (!success) {
      setError('Đăng nhập thất bại. Kiểm tra lại username/password.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Welcome Chat App</h2>
        {error && <p className="error-msg">{error}</p>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập userA hoặc userB"
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-login">Đăng nhập</button>
          <p style={{marginTop: '15px', fontSize: '0.9rem', color: '#b0b3b8'}}>
            Chưa có tài khoản? <Link to="/register" style={{color: '#007bff'}}>Đăng ký</Link>
          </p>
        </form>
        
      </div>
    </div>
    
  );
};

export default LoginPage;