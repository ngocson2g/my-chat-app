import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { contactApi, chatApi, userApi } from '../../services/api';
import { useNavigation, useIsFocused } from '@react-navigation/native';

export default function ContactsScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [acceptingIds, setAcceptingIds] = useState(new Set());

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const me = await userApi.getMe();
      setCurrentUser(me);

      const data = await contactApi.getList();
      
      // Lọc dữ liệu giống hệt bản Web
      const acceptedList = data.filter(c => c.status === 'accepted');
      const formattedFriends = acceptedList.map(c => {
        const isMeFrom = c.user_from === me.username;
        return {
          id: c.id,
          username: isMeFrom ? c.user_to : c.user_from,
          connected_at: c.created_at
        };
      });

      // Lọc danh sách chờ kết bạn (người khác gửi cho mình)
      const pendingList = data.filter(c => c.status === 'pending' && c.user_to === me.username);
      const formattedPending = pendingList.map(c => ({
        id: c.id,
        username: c.user_from,
        created_at: c.created_at
      }));

      setFriends(formattedFriends);
      setPendingRequests(formattedPending);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchContacts();
    }
  }, [isFocused]);

  const handleAddFriend = async () => {
    if (!newFriendUsername) return;
    try {
      await contactApi.sendRequest(newFriendUsername);
      Alert.alert('Thành công', `Đã gửi lời mời kết bạn đến ${newFriendUsername}`);
      setShowAddFriend(false);
      setNewFriendUsername('');
      fetchContacts(); // Tải lại danh sách
    } catch (error) {
      Alert.alert('Lỗi', 'Không tìm thấy người dùng này hoặc bạn đã gửi lời mời rồi.');
    }
  };

  const handleAcceptRequest = async (contactId) => {
    if (acceptingIds.has(contactId)) return; // Chống double-tap
    setAcceptingIds(prev => new Set(prev).add(contactId));
    
    try {
      await contactApi.acceptRequest(contactId);
      Alert.alert('Thành công', 'Đã chấp nhận lời mời kết bạn!');
      fetchContacts();
    } catch (error) {
      console.log(error);
      Alert.alert('Lỗi', 'Không thể chấp nhận lời mời (hoặc bạn đã chấp nhận rồi)');
    } finally {
      setAcceptingIds(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  };

  const handleChat = async (username) => {
    try {
      const data = await chatApi.startConversation(username);
      navigation.navigate('ChatRoom', { conversationId: data.conversation_id, targetUsername: username });
    } catch (err) {
      Alert.alert("Lỗi", "Không thể bắt đầu chat");
    }
  };

  const renderFriend = ({ item }) => (
    <View style={styles.friendCard}>
      <View style={styles.avatarSmall}>
        <Text style={styles.avatarText}>{String(item?.username || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.username}</Text>
      </View>
      <TouchableOpacity 
        style={styles.chatBtn}
        onPress={() => handleChat(item.username)}
      >
        <Ionicons name="chatbubble-ellipses" size={20} color="#6366f1" />
      </TouchableOpacity>
    </View>
  );

  const renderPending = ({ item }) => (
    <View style={styles.friendCard}>
      <View style={styles.avatarSmall}>
        <Text style={styles.avatarText}>{String(item?.username || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>{item.username}</Text>
        <Text style={{color: '#94a3b8', fontSize: 12}}>Muốn kết bạn với bạn</Text>
      </View>
      <TouchableOpacity 
        style={[styles.chatBtn, { backgroundColor: '#10b981' }]}
        onPress={() => handleAcceptRequest(item.id)}
        disabled={acceptingIds.has(item.id)}
      >
        {acceptingIds.has(item.id) ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="checkmark" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Danh bạ</Text>
        <TouchableOpacity onPress={() => setShowAddFriend(!showAddFriend)}>
          <Ionicons name={showAddFriend ? "close-circle" : "person-add"} size={28} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {showAddFriend && (
        <View style={styles.addFriendSection}>
          <TextInput 
            style={styles.searchInput}
            placeholder="Nhập username..."
            placeholderTextColor="#94a3b8"
            value={newFriendUsername}
            onChangeText={setNewFriendUsername}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddFriend}>
            <Text style={styles.addBtnText}>Thêm</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#6366f1" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          ListHeaderComponent={() => (
            <View>
              {pendingRequests.length > 0 && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Lời mời kết bạn ({pendingRequests.length})</Text>
                  {pendingRequests.map(item => (
                    <View key={item.id}>{renderPending({ item })}</View>
                  ))}
                </View>
              )}
              
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Bạn bè ({friends.length})</Text>
                {friends.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={60} color="#334155" />
                    <Text style={styles.emptyText}>Chưa có bạn bè nào</Text>
                  </View>
                )}
              </View>
            </View>
          )}
          data={friends}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderFriend}
          contentContainerStyle={{ padding: 15 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080911' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerText: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
  sectionContainer: { marginBottom: 20 },
  sectionTitle: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
  addFriendSection: { flexDirection: 'row', padding: 15, backgroundColor: 'rgba(18, 20, 32, 0.7)' },
  searchInput: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', color: '#f8fafc', borderRadius: 8, paddingHorizontal: 15, height: 44 },
  addBtn: { backgroundColor: '#6366f1', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 8, marginLeft: 10 },
  addBtnText: { color: '#fff', fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 30 },
  emptyText: { color: '#94a3b8', fontSize: 16, marginTop: 10 },
  friendCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(18, 20, 32, 0.7)', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  avatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3f3f46', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  friendInfo: { flex: 1, marginLeft: 15 },
  friendName: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  chatBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(99, 102, 241, 0.2)', justifyContent: 'center', alignItems: 'center' }
});
