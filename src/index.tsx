import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ConfigProvider } from 'antd';

// 禁用 findDOMNode 警告
const originalConsoleError = console.error;
console.error = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('findDOMNode')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <ConfigProvider>
    <App />
  </ConfigProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
