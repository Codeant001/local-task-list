import React, { useEffect } from 'react';
import './App.css';
import MindMap from './components/MindMap';

function App() {
  // 创建全局弹出层容器
  useEffect(() => {
    // 创建弹出层容器
    const popupContainer = document.createElement('div');
    popupContainer.id = 'antd-popup-container';
    document.body.appendChild(popupContainer);

    return () => {
      // 清理
      document.body.removeChild(popupContainer);
    };
  }, []);

  return (
    <div className="App">
      <MindMap />
    </div>
  );
}

export default App;
