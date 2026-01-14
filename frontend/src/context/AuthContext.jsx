import { createContext, useState, useContext, useEffect, useLayoutEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    const authInterceptor = api.interceptors.request.use((config) => {
        // Logic mới: Chỉ gắn token từ state NẾU request chưa có Authorization header
        // Điều này giúp cái header thủ công trong hàm login() không bị ghi đè
        if (token && !config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    });

    return () => {
        api.interceptors.request.eject(authInterceptor);
    }
  }, [token]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Gọi refresh để lấy token
        const res = await api.post('token/refresh/');
        setToken(res.data.access);
        
        // Lấy thông tin user
        const userRes = await api.get('users/me/', {
           headers: { Authorization: `Bearer ${res.data.access}` } 
        });
        setUser(userRes.data);
      } catch (error) {
        // Nếu lỗi 400/401 -> Chưa đăng nhập -> Không làm gì cả, chỉ set null
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await api.post('login/', { username, password });
      const { access } = res.data;
      
      // Cập nhật state (nhưng nó chưa cập nhật ngay lập tức)
      setToken(access); 
      
      // Gọi user info với token thủ công
      // Nhờ sửa Interceptor ở trên, cái header này sẽ KHÔNG bị xóa nữa
      const userRes = await api.get('users/me/', {
          headers: { Authorization: `Bearer ${access}` }
      });
      
      setUser(userRes.data);
      return true;
    } catch (error) {
      console.error("Login failed", error);
      return false;
    }
  };
  

  // 4. Hàm Logout
  const logout = async () => {
    try {
        await api.post('logout/'); // Gọi Server xóa cookie
    } catch (e) {
        console.error(e);
    }
    setToken(null);
    setUser(null);
    // Có thể reload trang để xóa sạch state rác
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);