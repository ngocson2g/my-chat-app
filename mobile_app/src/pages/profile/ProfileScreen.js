import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userApi } from '../../services/api';

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ display_name: '', phone_number: '' });

  // Fix kẹt màn hình do fake token
  const handleLogout = async () => {
    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    Alert.alert('Thông báo', 'Đã đăng xuất. Vui lòng tải lại App (bấm phím r trên terminal) để về màn hình Đăng Nhập!');
  };

  const fetchProfile = async () => {
    try {
      const data = await userApi.getMe();
      setProfile(data);
      setFormData({
        display_name: data.display_name || '',
        phone_number: data.phone_number || ''
      });
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Không thể tải hồ sơ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      await userApi.updateProfile(formData);
      Alert.alert('Thành công', 'Cập nhật hồ sơ thành công!');
      setIsEditing(false);
      fetchProfile();
    } catch (error) {
      Alert.alert('Lỗi', 'Cập nhật thất bại!');
      setLoading(false);
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#6366f1" style={{marginTop: 50}} />
      </SafeAreaView>
    );
  }

  if (!profile) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.errorText}>Lỗi kết nối Server!</Text>
        </SafeAreaView>
      );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Hồ sơ cá nhân</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{String(profile?.username || '?')[0].toUpperCase()}</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tên đăng nhập</Text>
          <Text style={styles.readonlyValue}>@{profile.username}</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tên hiển thị</Text>
          {isEditing ? (
            <TextInput 
              style={styles.input}
              value={formData.display_name}
              onChangeText={(text) => setFormData({...formData, display_name: text})}
              placeholder="Nhập tên hiển thị"
              placeholderTextColor="#94a3b8"
            />
          ) : (
            <Text style={styles.value}>{profile.display_name || 'Chưa cập nhật'}</Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Số điện thoại</Text>
          {isEditing ? (
            <TextInput 
              style={styles.input}
              value={formData.phone_number}
              onChangeText={(text) => setFormData({...formData, phone_number: text})}
              placeholder="Nhập số điện thoại"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
          ) : (
            <Text style={styles.value}>{profile.phone_number || 'Chưa cập nhật'}</Text>
          )}
        </View>

        <View style={styles.actionContainer}>
          {isEditing ? (
            <>
              <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
                <Text style={styles.btnText}>Lưu thay đổi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setIsEditing(false)}>
                <Text style={styles.btnText}>Hủy</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.btn, styles.editBtn]} onPress={() => setIsEditing(true)}>
                <Text style={styles.btnText}>Chỉnh sửa thông tin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.logoutBtn]} onPress={handleLogout}>
                <Text style={styles.btnText}>Đăng xuất</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080911',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  card: {
    margin: 20,
    backgroundColor: 'rgba(18, 20, 32, 0.7)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  readonlyValue: {
    color: '#64748b',
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
  },
  value: {
    color: '#f8fafc',
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
  },
  input: {
    color: '#f8fafc',
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: '#6366f1',
    borderRadius: 10,
  },
  actionContainer: {
    marginTop: 10,
    gap: 10,
  },
  btn: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
  },
  cancelBtn: {
    backgroundColor: '#ef4444',
  },
  logoutBtn: {
    backgroundColor: '#ef4444',
    marginTop: 10,
  }
});
