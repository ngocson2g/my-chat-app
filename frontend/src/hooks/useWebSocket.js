import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket'; // Import service vừa tạo

export const useWebSocket = () => {
    const { user } = useAuth();

    useEffect(() => {
        // Chỉ kết nối khi có thông tin user
        if (user && user.username) {
            socketService.connect(user.username);
        }

        // Cleanup: Khi user logout (user == null) thì ngắt kết nối
        return () => {
            if (!user) {
                socketService.disconnect();
            }
        };
    }, [user]);

    // Trả về instance service nếu component cần gọi hàm send() trực tiếp
    return socketService;
};