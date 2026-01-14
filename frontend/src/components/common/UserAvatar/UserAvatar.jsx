import React from 'react';
import './UserAvatar.css';

const UserAvatar = ({ name }) => {
  const initial = name ? name.charAt(0) : "?";
  return <div className="avatar-circle">{initial}</div>;
};

export default UserAvatar;