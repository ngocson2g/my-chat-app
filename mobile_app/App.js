import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, Animated, TouchableOpacity } from 'react-native';
import { NavigationContainer, DarkTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import LoginPage from './src/pages/auth/LoginPage';
import ProfileScreen from './src/pages/profile/ProfileScreen';
import ContactsScreen from './src/pages/contacts/ContactsScreen';
import ChatListScreen from './src/pages/chat/ChatListScreen';
import ChatRoomScreen from './src/pages/chat/ChatRoomScreen';
import NotificationsScreen from './src/pages/notifications/NotificationsScreen';
import socketService from './src/services/socket';
import { userApi } from './src/services/api';

// --- TOAST NOTIFICATION & GLOBAL SOCKET ---
function GlobalSocketHandler() {
  const navigation = useNavigation();
  const [toast, setToast] = useState(null);
  const translateY = useRef(new Animated.Value(-150)).current;
  const currentUserRef = useRef(null);

  useEffect(() => {
    const initGlobalSocket = async () => {
      try {
        const me = await userApi.getMe();
        if (me && me.username) {
          currentUserRef.current = me.username;
          socketService.connect(me.username);
        }
      } catch (e) {
        // Chưa đăng nhập
      }
    };
    initGlobalSocket();

    const unsubscribe = socketService.on('chat-update', (data) => {
      // Lấy state navigation để biết user đang ở đâu
      const state = navigation.getState();
      const currentRoute = state ? state.routes[state.index] : null;
      // Cần cẩn thận khi route lồng nhau (Tab -> Stack)
      
      // Tạm thời đơn giản: cứ nhận tin nhắn mới là báo (nếu là new_message)
      if (data.type === 'new_message' && data.sender !== currentUserRef.current) {
        showToast({
          title: `Tin nhắn từ ${data.sender}`,
          message: data.content,
          onPress: () => {
            navigation.navigate('ChatRoom', { 
              conversationId: data.conversation_id, 
              targetUsername: data.sender 
            });
            hideToast();
          }
        });
      }
    });

    return () => unsubscribe();
  }, [navigation]);

  const showToast = (config) => {
    setToast(config);
    Animated.spring(translateY, {
      toValue: 50,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      hideToast();
    }, 4000); // Ẩn sau 4s
  };

  const hideToast = () => {
    Animated.timing(translateY, {
      toValue: -150,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setToast(null));
  };

  if (!toast) return null;

  return (
    <Animated.View style={[styles.toastContainer, { transform: [{ translateY }] }]}>
      <TouchableOpacity activeOpacity={0.9} style={styles.toastContent} onPress={toast.onPress}>
        <View style={styles.toastIcon}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        </View>
        <View style={styles.toastTextContainer}>
          <Text style={styles.toastTitle}>{toast.title}</Text>
          <Text style={styles.toastMessage} numberOfLines={1}>{toast.message}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// --- CÁC MÀN HÌNH CHÍNH CỦA APP ---





// --- TAB NAVIGATOR (Thanh Menu Dưới Đáy - Cấu trúc Zalo) ---
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Chats') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'Contacts') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          // Trả về icon từ thư viện Ionicons (có sẵn trong Expo)
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366f1', // Màu chàm (Indigo) cho tab đang chọn
        tabBarInactiveTintColor: '#94a3b8', // Màu xám cho tab không chọn
        tabBarStyle: {
          backgroundColor: '#0a0b14', // Màu nền tối cho Tab Bar
          borderTopColor: 'rgba(255,255,255,0.08)', // Viền trên mờ
          height: 60,
          paddingBottom: 10,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        }
      })}
    >
      <Tab.Screen name="Chats" component={ChatListScreen} options={{ tabBarLabel: 'Tin nhắn' }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{ tabBarLabel: 'Danh bạ' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarLabel: 'Thông báo' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Cá nhân' }} />
    </Tab.Navigator>
  );
}

// --- STACK NAVIGATOR (Luồng Chuyển Màn Hình Chính) ---
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <GlobalSocketHandler />
      <Stack.Navigator initialRouteName="Login">
        {/* Màn hình đăng nhập */}
        <Stack.Screen
          name="Login"
          component={LoginPage}
          options={{ headerShown: false }}
        />

        {/* Sau khi đăng nhập, chuyển sang Main chứa thanh Tab Menu */}
        <Stack.Screen
          name="Main"
          component={MainTabNavigator}
          options={{ headerShown: false }}
        />
        
        {/* Màn hình Chat (không có thanh Tab dưới đáy) */}
        <Stack.Screen 
          name="ChatRoom" 
          component={ChatRoomScreen} 
          options={{ headerShown: false }} 
        />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080911',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  toastIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  toastMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  }
});
