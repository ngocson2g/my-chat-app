import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Đổi 192.168.x.x thành IP thực tế của máy bạn nếu test trên điện thoại thật!
// Trên Android Emulator, 10.0.2.2 trỏ về localhost của máy tính.
// Lấy URL từ file .env (EXPO_PUBLIC_API_URL)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/' : 'http://localhost:8000/api/');

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Lỗi lấy token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- CÁC HÀM API CHUYỂN TỪ WEB SANG ---

export const authApi = {
  login: (credentials) => api.post('login/', credentials), 
  register: (userData) => api.post('register/', userData),
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

export const notificationApi = {
  getList: () => api.get('notifications/').then(res => res.data),
  markRead: (id) => api.post(`notifications/${id}/mark_read/`).then(res => res.data),
};

export const chatApi = {
  getConversations: () => api.get('conversations/').then(res => res.data),
  startConversation: (username) => api.post('conversations/start/', { username }).then(res => res.data),
  getMessages: (conversationId, page = 1) => api.get(`conversations/${conversationId}/messages/?page=${page}`).then(res => res.data),
  sendMessage: (conversationId, content) => api.post(`conversations/${conversationId}/messages/`, { content }).then(res => res.data),
};

export default api;
