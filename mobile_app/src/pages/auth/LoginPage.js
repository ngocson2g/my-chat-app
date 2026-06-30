import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../../services/api';

// Vì LinearGradient cần phải cài thêm thư viện expo-linear-gradient, ta sẽ dùng View với background color thay thế cho gradient tạm thời, hoặc yêu cầu user cài đặt.
// Để đơn giản, ta sẽ code thuần CSS React Native.

export default function LoginPage({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleAuth = async () => {
    if (!username || !password) {
      Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        // Đăng ký
        await authApi.register({ username, password });
        Alert.alert('Thành công', 'Đăng ký thành công! Đang tự động đăng nhập...');
      }
      
      // Gọi API Đăng nhập
      const response = await authApi.login({ username, password });
      
      setLoading(false);
      // Lưu token thật vào bộ nhớ máy
      await AsyncStorage.setItem('access_token', response.data.access);
      if (response.data.refresh) {
          await AsyncStorage.setItem('refresh_token', response.data.refresh);
      }
      
      navigation.replace('Main'); // Chuyển sang cụm màn hình chính có Tab Menu
      
    } catch (error) {
      setLoading(false);
      if (isRegister) {
        Alert.alert('Lỗi đăng ký', 'Tên đăng nhập đã tồn tại hoặc không hợp lệ!');
      } else {
        Alert.alert('Lỗi đăng nhập', 'Sai tên đăng nhập hoặc mật khẩu!');
      }
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.glassCard}>
        <View style={styles.topHighlight} />
        
        <Text style={styles.title}>{isRegister ? "Đăng Ký" : "Đăng Nhập"}</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tên đăng nhập</Text>
          <TextInput 
            style={styles.input}
            placeholder="Nhập tên đăng nhập"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput 
            style={styles.input}
            placeholder="Nhập mật khẩu"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleAuth}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>{isRegister ? "Đăng ký" : "Bắt đầu"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.registerLink} onPress={() => setIsRegister(!isRegister)}>
          <Text style={styles.registerText}>
            {isRegister ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <Text style={styles.registerHighlight}>{isRegister ? "Đăng nhập ngay" : "Đăng ký ngay"}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080911', // Midnight Deep
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  glassCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(18, 20, 32, 0.7)',
    borderRadius: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#6366f1', // Indigo Accent
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 30,
    letterSpacing: -0.5,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 16,
  },
  loginButton: {
    width: '100%',
    backgroundColor: '#6366f1', // Primary Indigo
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  registerHighlight: {
    color: '#6366f1',
    fontWeight: 'bold',
  }
});
