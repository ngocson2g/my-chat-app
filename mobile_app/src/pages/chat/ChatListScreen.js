import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { chatApi } from '../../services/api';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import socketService from '../../services/socket';

export default function ChatListScreen() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const isFocused = useIsFocused(); // Hook để biết màn hình có đang được hiển thị không

  const fetchConversations = async () => {
    try {
      const data = await chatApi.getConversations();
      setConversations(data);
    } catch (error) {
      console.log('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchConversations();
    }
  }, [isFocused]);

  useEffect(() => {
    // Lắng nghe sự kiện nhắn tin khi đang ở màn hình này
    const unsubscribe = socketService.on('chat-update', (data) => {
      fetchConversations();
    });
    return () => unsubscribe();
  }, []);

  const renderItem = ({ item }) => {
    // Tên của bạn chat (API trả về conversation_name)
    const targetUsername = item.conversation_name || 'Ẩn danh';
    
    let lastMessageText = 'Chưa có tin nhắn';
    if (item.last_message) {
      if (typeof item.last_message === 'string') {
        lastMessageText = item.last_message;
      } else if (item.last_message.content) {
        lastMessageText = item.last_message.content;
      }
    }

    return (
      <TouchableOpacity 
        style={styles.chatCard} 
        onPress={() => navigation.navigate('ChatRoom', { conversationId: item.conversation_id, targetUsername: targetUsername })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{String(targetUsername)[0].toUpperCase()}</Text>
        </View>
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{targetUsername}</Text>
          <Text style={styles.chatMessage} numberOfLines={1}>{lastMessageText}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Tin nhắn</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{marginTop: 50}} />
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Chưa có đoạn hội thoại nào</Text>
        </View>
      ) : (
        <FlatList 
          data={conversations}
          keyExtractor={(item, index) => (item?.conversation_id ? item.conversation_id.toString() : index.toString())}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
        />
      )}
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 20, 32, 0.7)',
    padding: 15,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 15,
  },
  chatName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  chatMessage: {
    color: '#94a3b8',
    fontSize: 14,
  }
});
