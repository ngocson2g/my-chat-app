import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificationApi } from '../../services/api';
import { useIsFocused } from '@react-navigation/native';
import socketService from '../../services/socket';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();

  const fetchNotifications = async () => {
    try {
      const data = await notificationApi.getList();
      setNotifications(data);
    } catch (error) {
      console.log('Error loading notifications', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) fetchNotifications();
  }, [isFocused]);

  useEffect(() => {
    // Lắng nghe sự kiện để tự động cập nhật danh sách
    const unsubscribe = socketService.on('chat-update', (data) => {
      fetchNotifications();
    });
    return () => unsubscribe();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      fetchNotifications();
    } catch (error) {
      console.log(error);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.notificationCard, !item.is_read && styles.unreadCard]}
      onPress={() => handleMarkRead(item.id)}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name={item.notification_type === 'friend_request' ? "person-add" : "notifications"} 
          size={24} 
          color="#6366f1" 
        />
      </View>
      <View style={styles.contentContainer}>
        <Text style={[styles.message, !item.is_read && styles.unreadMessage]}>
          {item.content}
        </Text>
        <Text style={styles.time}>{new Date(item.created_at).toLocaleString('vi-VN')}</Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Thông báo</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{marginTop: 50}} />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={60} color="#334155" />
          <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
        </View>
      ) : (
        <FlatList 
          data={notifications}
          keyExtractor={(item) => item.id.toString()}
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
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 10,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 20, 32, 0.7)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  unreadCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    marginLeft: 15,
  },
  message: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  unreadMessage: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  time: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 5,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    marginLeft: 10,
  }
});
