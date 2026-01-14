import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { contactApi, chatApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const useContacts = () => {
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const { user } = useAuth();
    const navigate = useNavigate();

    const loadFriends = useCallback(async () => {
        setLoading(true);
        try {
            const data = await contactApi.getList();
            // Logic lọc và map dữ liệu nằm ở đây, UI không cần biết
            const acceptedList = data.filter(c => c.status === 'accepted');
            const formattedList = acceptedList.map(c => {
                const isMeFrom = c.user_from === user.username;
                return {
                    id: c.id,
                    username: isMeFrom ? c.user_to : c.user_from,
                    connected_at: c.created_at
                };
            });
            setFriends(formattedList);
        } catch (err) {
            setError(err);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [user.username]);

    const startChat = async (friendUsername) => {
        try {
            const data = await chatApi.startConversation(friendUsername);
            navigate('/', { state: { targetChatId: data.conversation_id } });
        } catch (err) {
            alert("Lỗi khi bắt đầu chat: " + (err.message || "Không xác định"));
        }
    };

    useEffect(() => {
        loadFriends();
    }, [loadFriends]);

    return { friends, loading, error, loadFriends, startChat };
};