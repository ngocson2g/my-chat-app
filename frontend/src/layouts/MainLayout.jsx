import { Outlet } from 'react-router-dom';
import SidebarMenu from '../components/layout/SidebarMenu';

const MainLayout = () => {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#18191a' }}>
      {/* Menu luôn cố định bên trái */}
      <SidebarMenu />
      
      {/* Nội dung thay đổi (Chat, Profile, Help) nằm bên phải */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </div>
    </div>
  );
};

export default MainLayout;