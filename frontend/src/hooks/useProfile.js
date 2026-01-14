import { useState, useEffect } from 'react';
import { userApi } from '../services/api';

export const useProfile = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const data = await userApi.getMe();
            setProfile(data);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (data) => {
        try {
            const updatedUser = await userApi.updateProfile(data);
            setProfile(updatedUser);
            return { success: true };
        } catch (err) {
            console.error(err);
            return { success: false, error: err };
        }
    };

    return { profile, loading, error, updateProfile };
};