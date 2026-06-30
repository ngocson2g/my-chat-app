import axios from 'axios';

// Lấy URL từ biến môi trường
const BASE_URL = '/api/';//import.meta.env.VITE_API_BASE_URL

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // QUAN TRỌNG: Cho phép gửi/nhận Cookie (HttpOnly)
    withCredentials: true, 
    timeout: 10000,
});

// --- REQUEST INTERCEPTOR ---
// (Token sẽ được AuthContext inject vào header, 
// nhưng nếu bạn muốn chắc chắn thì giữ lại logic lấy từ memory nếu có biến toàn cục)
// Ở đây ta để AuthContext lo việc set header Authorization.

// --- RESPONSE INTERCEPTOR ---
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // Kiểm tra lỗi 401
        if (error.response?.status === 401 && !originalRequest._retry) {
            
            // --- SỬA LỖI SPAM TẠI ĐÂY ---
            // Nếu URL bị lỗi chính là '/token/refresh/', nghĩa là refresh thất bại.
            // TUYỆT ĐỐI KHÔNG gọi lại nữa, nếu không sẽ lặp vô tận.
            if (originalRequest.url.includes('token/refresh/')) {
                return Promise.reject(error);
            }
            // -----------------------------

            originalRequest._retry = true;
            try {
                const res = await api.post('token/refresh/');
                if (res.status === 200) {
                    const newAccessToken = res.data.access;
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    // Phát sự kiện để cập nhật AuthContext token
                    window.dispatchEvent(new CustomEvent('token-refreshed', { detail: newAccessToken }));
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // Refresh thất bại -> Chấp nhận lỗi, AuthContext sẽ lo việc logout
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

// --- EXPORT API HELPERS GIỮ NGUYÊN ---
export const authApi = {
    login: (credentials) => api.post('login/', credentials),
    register: (userData) => api.post('register/', userData),
    logout: () => api.post('logout/'),
};

export const userApi = {
    getMe: () => api.get('users/me/').then(res => res.data),
    updateProfile: (data) => api.put('users/me/', data).then(res => res.data),
    search: (query, limit = 20) => api.get(`users/search/?q=${query}&limit=${limit}`).then(res => res.data),
};

export const contactApi = {
    getList: () => api.get('contacts/').then(res => res.data),
    sendRequest: (username) => api.post('contacts/send_request/', { username }).then(res => res.data),
    acceptRequest: (contactId) => api.post(`contacts/${contactId}/accept_request/`).then(res => res.data),
};

export const chatApi = {
    getConversations: () => api.get('conversations/').then(res => res.data),
    startConversation: (username) => api.post('conversations/start/', { username }).then(res => res.data),
    getMessages: (conversationId, page = 1) => api.get(`conversations/${conversationId}/messages/?page=${page}`).then(res => res.data),
    sendMessage: (conversationId, content) => api.post(`conversations/${conversationId}/messages/`, { content }).then(res => res.data),
};

export const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('upload/', formData, {
        headers: { 'Content-Type': undefined }, // Xoá application/json mặc định, để trình duyệt tự set boundary
    });
    return response.data; 
};

export default api;