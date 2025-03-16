import React from 'react';
import { StyleProvider } from '@ant-design/cssinjs';
import './App.css';
import MindMap from './components/MindMap';

function App() {
  return (
    <StyleProvider hashPriority="high">
      <div className="App">
        <MindMap />
      </div>
    </StyleProvider>
  );
}

export default App;
