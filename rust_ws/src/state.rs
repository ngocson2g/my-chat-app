use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use warp::ws::Message;

// Định nghĩa alias Users
// Lưu ý: Message ở đây là warp::ws::Message
pub type Users = Arc<Mutex<HashMap<String, mpsc::UnboundedSender<Message>>>>;

// Hàm helper để khởi tạo state rỗng
pub fn init_users() -> Users {
    Arc::new(Mutex::new(HashMap::new()))
}