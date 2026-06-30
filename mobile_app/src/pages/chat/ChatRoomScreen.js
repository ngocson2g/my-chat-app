import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Linking } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { chatApi, userApi } from '../../services/api';
import socketService from '../../services/socket';

export default function ChatRoomScreen({ route, navigation }) {
  // Lấy dữ liệu truyền từ màn hình trước
  const { conversationId, targetUsername } = route.params;
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  const flatListRef = useRef(null);

  // Khởi tạo phòng chat
  useEffect(() => {
    const initChat = async () => {
      try {
        // Lấy thông tin user hiện tại để phân biệt tin nhắn gửi/nhận
        const me = await userApi.getMe();
        setCurrentUser(me);

        // KẾT NỐI WEBSOCKET
        socketService.connect(me.username);

        // Lấy lịch sử tin nhắn
        const msgs = await chatApi.getMessages(conversationId);
        // Backend trả về mảng xếp theo thời gian tăng dần (cũ nhất -> mới nhất).
        // Ta cần đảo ngược mảng để tin mới nhất nằm ở index 0 (phù hợp với inverted FlatList)
        const dataArray = msgs.results || msgs || [];
        setMessages([...dataArray].reverse());
      } catch (error) {
        console.log('Error loading messages', error);
      } finally {
        setLoading(false);
      }
    };
    
    initChat();

    // LẮNG NGHE SỰ KIỆN TIN NHẮN MỚI
    const unsubscribe = socketService.on('chat-update', (data) => {
      // payload: { type: "new_message", message_id, content, sender, conversation_id, created_at, message_type }
      if (data.type === 'new_message' && String(data.conversation_id).toLowerCase() === String(conversationId).toLowerCase()) {
        setMessages(prev => {
          const isExist = prev.find(m => String(m.id || m.message_id) === String(data.message_id));
          if (isExist) return prev;
          
          const newMessage = {
            id: data.message_id || Date.now(),
            content: data.content,
            sender: data.sender,
            created_at: data.created_at,
            message_type: data.message_type || 'text'
          };
          
          return [newMessage, ...prev]; // Push lên đầu vì danh sách đã đảo ngược (inverted)
        });
      }
    });

    // Cleanup khi thoát phòng chat
    return () => {
      unsubscribe();
    };
  }, [conversationId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const textToSend = inputText.trim();
    setInputText(''); // Xóa khung nhập ngay lập tức cho mượt
    
    try {
      await chatApi.sendMessage(conversationId, textToSend);
      // Gọi api gửi tin nhắn thật sự
    } catch (error) {
      console.log('Send message failed', error);
      // Có thể hiển thị thông báo lỗi gửi tin
    }
  };

  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    // Lấy API_URL từ biến môi trường, bỏ đi phần "/api/" ở đuôi nếu có
    const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.218:8000/api/').replace(/\/api\/?$/, '');
    return `${baseUrl}${url}`;
  };

  const renderMessageContent = (item, isMyMessage) => {
    const mediaUrl = getFullUrl(item.content);
    
    if (item.message_type === 'image') {
      return (
        <Image 
          source={{ uri: mediaUrl }} 
          style={{ width: 220, height: 220, borderRadius: 10 }} 
          resizeMode="cover"
        />
      );
    } else if (item.message_type === 'video') {
      return (
        <Video
          style={{ width: 220, height: 220, borderRadius: 10 }}
          source={{ uri: mediaUrl }}
          useNativeControls
          resizeMode={ResizeMode.COVER}
          isLooping={false}
        />
      );
    } else if (item.message_type === 'file' || item.message_type === 'audio') {
      // Tách tên file từ URL (xử lý cả những URL dài ngoằng)
      const fileName = item.content.split('/').pop()?.split('?')[0] || "Tệp đính kèm";
      
      return (
        <TouchableOpacity onPress={() => Linking.openURL(mediaUrl)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isMyMessage ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.1)', padding: 10, borderRadius: 8 }}>
            <Ionicons name={item.message_type === 'audio' ? "headset" : "document-text"} size={24} color={isMyMessage ? "#fff" : "#6366f1"} />
            <Text style={[styles.messageText, { marginLeft: 10, textDecorationLine: 'underline', flexShrink: 1 }]} numberOfLines={1}>
              {decodeURIComponent(fileName)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    } else {
      return <Text style={styles.messageText}>{item.content}</Text>;
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender === currentUser?.username;
    
    return (
      <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage]}>
        {!isMyMessage && (
           <View style={styles.avatarSmall}>
              <Text style={styles.avatarText}>{String(item.sender || '?')[0].toUpperCase()}</Text>
           </View>
        )}
        <View style={[styles.messageContent, isMyMessage ? styles.myMessageContent : styles.theirMessageContent]}>
          {renderMessageContent(item, isMyMessage)}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#f8fafc" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{targetUsername}</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
           <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => (item?.id ? item.id.toString() : index.toString())}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 15 }}
          inverted
        />
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor="#94a3b8"
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080911',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: Platform.OS === 'android' ? 40 : 15,
    backgroundColor: 'rgba(18, 20, 32, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 15,
    alignItems: 'flex-end',
  },
  myMessage: {
    justifyContent: 'flex-end',
  },
  theirMessage: {
    justifyContent: 'flex-start',
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#3f3f46',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messageContent: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 20,
  },
  myMessageContent: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 5,
  },
  theirMessageContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    color: '#f8fafc',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: 'rgba(18, 20, 32, 0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  }
});
