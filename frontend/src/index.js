import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import Attendees from './Attendees';
import LuckyDraw from './LuckyDraw';
import TreePage from './TreePage';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/attendees" element={<Attendees />} />
        <Route path="/lucky-draw" element={<LuckyDraw />} />
        <Route path="/tree" element={<TreePage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
